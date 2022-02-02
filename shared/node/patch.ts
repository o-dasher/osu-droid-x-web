import PatchLogicalAssignment from "./PatchLogicalAssignment";

const main = async () => {
  console.log("Patching...");
  await PatchLogicalAssignment.patch();
};

void main();

export {};
