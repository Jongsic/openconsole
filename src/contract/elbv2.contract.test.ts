// @vitest-environment node

import { beforeAll, it } from "vitest";
import { z } from "zod";
import { api } from "@/lib/elbv2-api";
import { assertContract, configureBackendFromEnv, contractDescribe } from "./harness";

const loadBalancer = z.object({
  arn: z.string(),
  name: z.string(),
  availabilityZones: z.array(z.string()),
});
const targetGroup = z.object({
  arn: z.string(),
  name: z.string(),
  loadBalancerArns: z.array(z.string()),
});

contractDescribe("ELBv2 api contract", () => {
  beforeAll(configureBackendFromEnv);

  it("listLoadBalancers", () => assertContract(api.listLoadBalancers, z.array(loadBalancer)));
  it("listTargetGroups", () => assertContract(api.listTargetGroups, z.array(targetGroup)));
});
