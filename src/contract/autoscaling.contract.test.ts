// @vitest-environment node

import { beforeAll, it } from "vitest";
import { z } from "zod";
import { api } from "@/lib/autoscaling-api";
import { assertContract, configureBackendFromEnv, contractDescribe } from "./harness";

const asg = z.object({
  name: z.string(),
  minSize: z.number(),
  maxSize: z.number(),
  desiredCapacity: z.number(),
  availabilityZones: z.array(z.string()),
  targetGroupArns: z.array(z.string()),
});

contractDescribe("AutoScaling api contract", () => {
  beforeAll(configureBackendFromEnv);

  it("listAutoScalingGroups", () => assertContract(api.listAutoScalingGroups, z.array(asg)));
});
