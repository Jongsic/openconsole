import {
  CreateListenerCommand,
  CreateLoadBalancerCommand,
  CreateRuleCommand,
  CreateTargetGroupCommand,
  DescribeListenersCommand,
  DescribeLoadBalancerAttributesCommand,
  DescribeLoadBalancersCommand,
  DescribeRulesCommand,
  DescribeTargetGroupAttributesCommand,
  DescribeTargetGroupsCommand,
  DescribeTargetHealthCommand,
  ElasticLoadBalancingV2Client,
  ModifyTargetGroupAttributesCommand,
  ModifyTargetGroupCommand,
  RegisterTargetsCommand,
} from "@aws-sdk/client-elastic-load-balancing-v2";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { api } from "./elbv2-api";

const elbv2 = mockClient(ElasticLoadBalancingV2Client);

beforeEach(() => elbv2.reset());

describe("listLoadBalancers mapping", () => {
  it("maps fields incl. zone names + createdTime", async () => {
    elbv2.on(DescribeLoadBalancersCommand).resolves({
      LoadBalancers: [
        {
          LoadBalancerArn: "arn:lb",
          LoadBalancerName: "web-lb",
          Type: "application",
          Scheme: "internet-facing",
          State: { Code: "active" },
          DNSName: "web-lb.example.com",
          VpcId: "vpc-1",
          AvailabilityZones: [{ ZoneName: "us-east-1a" }, { ZoneName: "us-east-1b" }],
          CreatedTime: new Date("2024-01-01T00:00:00Z"),
        },
      ],
    });
    const r = await api.listLoadBalancers();
    expect(r[0]).toMatchObject({
      arn: "arn:lb",
      name: "web-lb",
      type: "application",
      scheme: "internet-facing",
      state: "active",
      dnsName: "web-lb.example.com",
      availabilityZones: ["us-east-1a", "us-east-1b"],
      createdTime: "2024-01-01T00:00:00.000Z",
    });
  });

  it("returns [] when empty", async () => {
    elbv2.on(DescribeLoadBalancersCommand).resolves({});
    await expect(api.listLoadBalancers()).resolves.toEqual([]);
  });
});

describe("getListeners + rule conditionText/actionText", () => {
  it("renders forward, weighted-forward, redirect and fixed-response actions", async () => {
    elbv2.on(DescribeListenersCommand).resolves({
      Listeners: [
        {
          ListenerArn: "arn:listener",
          Port: 443,
          Protocol: "HTTPS",
          DefaultActions: [{ Type: "forward" }],
        },
      ],
    });
    elbv2.on(DescribeRulesCommand).resolves({
      Rules: [
        {
          RuleArn: "arn:rule-1",
          IsDefault: false,
          Priority: "10",
          Conditions: [{ Field: "path-pattern", PathPatternConfig: { Values: ["/api/*"] } }],
          Actions: [{ Type: "forward", TargetGroupArn: "arn:aws:x:targetgroup/web/abc" }],
        },
        {
          RuleArn: "arn:rule-2",
          Priority: "20",
          Conditions: [{ Field: "host-header", Values: ["api.example.com"] }],
          Actions: [
            {
              Type: "forward",
              ForwardConfig: {
                TargetGroups: [
                  { TargetGroupArn: "arn:aws:x:targetgroup/blue/1", Weight: 80 },
                  { TargetGroupArn: "arn:aws:x:targetgroup/green/2", Weight: 20 },
                ],
              },
            },
          ],
        },
        {
          RuleArn: "arn:rule-3",
          Priority: "30",
          Conditions: [],
          Actions: [
            {
              Type: "redirect",
              RedirectConfig: { Host: "new.example.com", Path: "/x", StatusCode: "HTTP_302" },
            },
          ],
        },
        {
          RuleArn: "arn:rule-default",
          IsDefault: true,
          Actions: [{ Type: "fixed-response", FixedResponseConfig: { StatusCode: "404" } }],
        },
      ],
    });
    const r = await api.getListeners("arn:lb");
    expect(r[0]).toMatchObject({ arn: "arn:listener", port: 443, protocol: "HTTPS" });
    const rules = r[0]?.rules ?? [];
    expect(rules[0]).toMatchObject({
      priority: "10",
      conditions: ["path-pattern: /api/*"],
      actions: ["forward → web"],
    });
    expect(rules[1]?.actions).toEqual(["forward → blue (80), green (20)"]);
    expect(rules[1]?.conditions).toEqual(["host-header: api.example.com"]);
    expect(rules[2]?.actions).toEqual(["redirect → new.example.com/x"]);
    expect(rules[3]).toMatchObject({ isDefault: true, priority: "—" });
    expect(rules[3]?.actions).toEqual(["fixed-response 404"]);
  });
});

describe("listTargetGroups mapping", () => {
  it("maps health-check fields + matcher + loadBalancerArns", async () => {
    elbv2.on(DescribeTargetGroupsCommand).resolves({
      TargetGroups: [
        {
          TargetGroupArn: "arn:tg",
          TargetGroupName: "web",
          Protocol: "HTTP",
          Port: 80,
          TargetType: "instance",
          VpcId: "vpc-1",
          HealthCheckPath: "/health",
          HealthCheckProtocol: "HTTP",
          HealthCheckIntervalSeconds: 30,
          HealthCheckTimeoutSeconds: 5,
          HealthyThresholdCount: 5,
          UnhealthyThresholdCount: 2,
          Matcher: { HttpCode: "200" },
          LoadBalancerArns: ["arn:lb"],
        },
      ],
    });
    const r = await api.listTargetGroups();
    expect(r[0]).toMatchObject({
      arn: "arn:tg",
      name: "web",
      protocol: "HTTP",
      port: 80,
      healthCheckPath: "/health",
      healthyThreshold: 5,
      unhealthyThreshold: 2,
      matcherHttpCode: "200",
      loadBalancerArns: ["arn:lb"],
    });
  });

  it("returns [] when empty", async () => {
    elbv2.on(DescribeTargetGroupsCommand).resolves({});
    await expect(api.listTargetGroups()).resolves.toEqual([]);
  });
});

describe("target group attributes mapping", () => {
  it("parses stickiness/dereg/algorithm keys", async () => {
    elbv2.on(DescribeTargetGroupAttributesCommand).resolves({
      Attributes: [
        { Key: "stickiness.enabled", Value: "true" },
        { Key: "stickiness.type", Value: "app_cookie" },
        { Key: "stickiness.lb_cookie.duration_seconds", Value: "3600" },
        { Key: "deregistration_delay.timeout_seconds", Value: "120" },
        { Key: "load_balancing.algorithm.type", Value: "least_outstanding_requests" },
      ],
    });
    const r = await api.getTargetGroupAttributes("arn:tg");
    expect(r).toEqual({
      stickinessEnabled: true,
      stickinessType: "app_cookie",
      stickinessDurationSeconds: 3600,
      deregistrationDelaySeconds: 120,
      loadBalancingAlgorithm: "least_outstanding_requests",
    });
  });

  it("falls back to defaults on an empty attribute set", async () => {
    elbv2.on(DescribeTargetGroupAttributesCommand).resolves({});
    const r = await api.getTargetGroupAttributes("arn:tg");
    expect(r).toEqual({
      stickinessEnabled: false,
      stickinessType: "lb_cookie",
      stickinessDurationSeconds: 86400,
      deregistrationDelaySeconds: 300,
      loadBalancingAlgorithm: "round_robin",
    });
  });
});

describe("getTargetHealth + getLoadBalancerAttributes", () => {
  it("maps target health descriptions", async () => {
    elbv2.on(DescribeTargetHealthCommand).resolves({
      TargetHealthDescriptions: [
        {
          Target: { Id: "i-1", Port: 80 },
          TargetHealth: {
            State: "unhealthy",
            Reason: "Target.ResponseCodeMismatch",
            Description: "bad code",
          },
        },
      ],
    });
    const r = await api.getTargetHealth("arn:tg");
    expect(r[0]).toEqual({
      id: "i-1",
      port: 80,
      state: "unhealthy",
      reason: "Target.ResponseCodeMismatch",
      description: "bad code",
    });
  });

  it("getLoadBalancerAttributes: http2 defaults to true unless explicitly 'false'", async () => {
    elbv2.on(DescribeLoadBalancerAttributesCommand).resolves({
      Attributes: [
        { Key: "idle_timeout.timeout_seconds", Value: "120" },
        { Key: "deletion_protection.enabled", Value: "true" },
      ],
    });
    const r = await api.getLoadBalancerAttributes("arn:lb");
    expect(r).toEqual({ idleTimeoutSeconds: 120, deletionProtection: true, http2Enabled: true });
  });
});

describe("write/command shapes", () => {
  it("createTargetGroup omits VpcId/HealthCheckPath when blank", async () => {
    elbv2.on(CreateTargetGroupCommand).resolves({});
    await api.createTargetGroup({
      name: "tg",
      protocol: "HTTP",
      port: 80,
      targetType: "instance",
    });
    const input = elbv2.commandCalls(CreateTargetGroupCommand)[0]?.args[0].input;
    expect(input).toEqual({ Name: "tg", Protocol: "HTTP", Port: 80, TargetType: "instance" });
  });

  it("createTargetGroup includes VpcId + HealthCheckPath when provided", async () => {
    elbv2.on(CreateTargetGroupCommand).resolves({});
    await api.createTargetGroup({
      name: "tg",
      protocol: "HTTP",
      port: 80,
      targetType: "ip",
      vpcId: "vpc-1",
      healthCheckPath: "/ping",
    });
    expect(elbv2.commandCalls(CreateTargetGroupCommand)[0]?.args[0].input).toMatchObject({
      VpcId: "vpc-1",
      HealthCheckPath: "/ping",
    });
  });

  it("modifyHealthCheck sends thresholds + matcher", async () => {
    elbv2.on(ModifyTargetGroupCommand).resolves({});
    await api.modifyHealthCheck("arn:tg", {
      path: "/health",
      intervalSeconds: 30,
      timeoutSeconds: 5,
      healthyThreshold: 5,
      unhealthyThreshold: 2,
      matcherHttpCode: "200,302",
    });
    expect(elbv2.commandCalls(ModifyTargetGroupCommand)[0]?.args[0].input).toMatchObject({
      TargetGroupArn: "arn:tg",
      HealthCheckPath: "/health",
      HealthCheckIntervalSeconds: 30,
      HealthCheckTimeoutSeconds: 5,
      HealthyThresholdCount: 5,
      UnhealthyThresholdCount: 2,
      Matcher: { HttpCode: "200,302" },
    });
  });

  it("modifyTargetGroupAttributes serializes all five attributes as strings", async () => {
    elbv2.on(ModifyTargetGroupAttributesCommand).resolves({});
    await api.modifyTargetGroupAttributes("arn:tg", {
      stickinessEnabled: true,
      stickinessType: "lb_cookie",
      stickinessDurationSeconds: 3600,
      deregistrationDelaySeconds: 120,
      loadBalancingAlgorithm: "round_robin",
    });
    const attrs = elbv2.commandCalls(ModifyTargetGroupAttributesCommand)[0]?.args[0].input
      ?.Attributes;
    expect(attrs).toEqual([
      { Key: "stickiness.enabled", Value: "true" },
      { Key: "stickiness.type", Value: "lb_cookie" },
      { Key: "stickiness.lb_cookie.duration_seconds", Value: "3600" },
      { Key: "deregistration_delay.timeout_seconds", Value: "120" },
      { Key: "load_balancing.algorithm.type", Value: "round_robin" },
    ]);
  });

  it("registerTarget omits Port when null", async () => {
    elbv2.on(RegisterTargetsCommand).resolves({});
    await api.registerTarget("arn:tg", "10.0.0.5", null);
    expect(elbv2.commandCalls(RegisterTargetsCommand)[0]?.args[0].input).toEqual({
      TargetGroupArn: "arn:tg",
      Targets: [{ Id: "10.0.0.5" }],
    });
  });

  it("registerTarget includes Port when provided", async () => {
    elbv2.on(RegisterTargetsCommand).resolves({});
    await api.registerTarget("arn:tg", "i-1", 8080);
    expect(elbv2.commandCalls(RegisterTargetsCommand)[0]?.args[0].input?.Targets?.[0]).toEqual({
      Id: "i-1",
      Port: 8080,
    });
  });

  it("createLoadBalancer omits SecurityGroups when empty", async () => {
    elbv2.on(CreateLoadBalancerCommand).resolves({});
    await api.createLoadBalancer({
      name: "lb",
      scheme: "internet-facing",
      type: "application",
      subnetIds: ["subnet-1", "subnet-2"],
      securityGroupIds: [],
    });
    const input = elbv2.commandCalls(CreateLoadBalancerCommand)[0]?.args[0].input;
    expect(input).toEqual({
      Name: "lb",
      Scheme: "internet-facing",
      Type: "application",
      Subnets: ["subnet-1", "subnet-2"],
    });
  });

  it("createListener (forward) sends a forward DefaultAction", async () => {
    elbv2.on(CreateListenerCommand).resolves({});
    await api.createListener({
      loadBalancerArn: "arn:lb",
      protocol: "HTTP",
      port: 80,
      action: { type: "forward", targetGroupArn: "arn:tg" },
    });
    expect(elbv2.commandCalls(CreateListenerCommand)[0]?.args[0].input?.DefaultActions).toEqual([
      { Type: "forward", TargetGroupArn: "arn:tg" },
    ]);
  });

  it("createListener (fixed-response) defaults contentType to text/plain", async () => {
    elbv2.on(CreateListenerCommand).resolves({});
    await api.createListener({
      loadBalancerArn: "arn:lb",
      protocol: "HTTP",
      port: 80,
      action: { type: "fixed-response", statusCode: "503", contentType: "", body: "down" },
    });
    expect(elbv2.commandCalls(CreateListenerCommand)[0]?.args[0].input?.DefaultActions).toEqual([
      {
        Type: "fixed-response",
        FixedResponseConfig: { StatusCode: "503", ContentType: "text/plain", MessageBody: "down" },
      },
    ]);
  });

  it("createRule splits comma values and builds a path-pattern condition", async () => {
    elbv2.on(CreateRuleCommand).resolves({});
    await api.createRule({
      listenerArn: "arn:listener",
      priority: 5,
      conditionField: "path-pattern",
      values: "/api/*, /v2/* ,",
      targetGroupArn: "arn:tg",
    });
    const input = elbv2.commandCalls(CreateRuleCommand)[0]?.args[0].input;
    expect(input?.Priority).toBe(5);
    expect(input?.Conditions).toEqual([
      { Field: "path-pattern", PathPatternConfig: { Values: ["/api/*", "/v2/*"] } },
    ]);
    expect(input?.Actions).toEqual([{ Type: "forward", TargetGroupArn: "arn:tg" }]);
  });

  it("createRule builds a host-header condition for that field", async () => {
    elbv2.on(CreateRuleCommand).resolves({});
    await api.createRule({
      listenerArn: "arn:listener",
      priority: 5,
      conditionField: "host-header",
      values: "api.example.com",
      targetGroupArn: "arn:tg",
    });
    expect(elbv2.commandCalls(CreateRuleCommand)[0]?.args[0].input?.Conditions).toEqual([
      { Field: "host-header", HostHeaderConfig: { Values: ["api.example.com"] } },
    ]);
  });
});
