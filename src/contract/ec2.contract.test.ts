// @vitest-environment node

import { beforeAll, it } from "vitest";
import { z } from "zod";
import { api } from "@/lib/ec2-api";
import { assertContract, configureBackendFromEnv, contractDescribe } from "./harness";

// Loose shapes: assert keys/types we map to, never values. Backends differ in
// which fields they populate — nullable/optional reflects that.
const instance = z.object({
  instanceId: z.string(),
  state: z.string(),
  instanceType: z.string().nullable(),
});
const securityGroup = z.object({
  groupId: z.string(),
  groupName: z.string(),
  inbound: z.array(z.object({ protocol: z.string(), source: z.string() })),
  outbound: z.array(z.object({ protocol: z.string() })),
});
const volume = z.object({ volumeId: z.string(), size: z.number(), encrypted: z.boolean() });
const keyPair = z.object({ keyName: z.string(), keyPairId: z.string() });
const subnet = z.object({ subnetId: z.string(), vpcId: z.string().nullable() });
const launchTemplate = z.object({
  launchTemplateId: z.string(),
  launchTemplateName: z.string(),
});

contractDescribe("EC2 api contract", () => {
  beforeAll(configureBackendFromEnv);

  it("listInstances", () => assertContract(api.listInstances, z.array(instance)));
  it("listSecurityGroups", () => assertContract(api.listSecurityGroups, z.array(securityGroup)));
  it("listVolumes", () => assertContract(api.listVolumes, z.array(volume)));
  it("listKeyPairs", () => assertContract(api.listKeyPairs, z.array(keyPair)));
  it("listSubnets", () => assertContract(api.listSubnets, z.array(subnet)));
  it("listLaunchTemplates", () => assertContract(api.listLaunchTemplates, z.array(launchTemplate)));
});
