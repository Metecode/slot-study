import { beforeEach, describe, vi } from "vitest";

import { fakeFs } from "./fakeFilesystem";
import { storageAdapterContract } from "./storageAdapterContract";
import { TEST_ADAPTERS } from "./testAdapters";

vi.mock("@capacitor/filesystem", () => import("./fakeFilesystem"));

beforeEach(() => fakeFs.reset());

describe.each(TEST_ADAPTERS)("%s sözleşmesi", (_name, create) => {
  storageAdapterContract(create);
});
