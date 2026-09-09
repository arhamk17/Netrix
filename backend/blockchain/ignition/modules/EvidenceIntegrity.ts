import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const EvidenceIntegrityModule = buildModule("EvidenceIntegrityModule", (m) => {
  const evidenceIntegrity = m.contract("EvidenceIntegrity");

  return { evidenceIntegrity };
});

export default EvidenceIntegrityModule;
