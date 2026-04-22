export function getCaseModelPath(modelId: string, caseTypeId: string) {
  return `/models/cases/${modelId}_${caseTypeId}.glb`;
}
