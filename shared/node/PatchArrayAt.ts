export const PatchArrayAt = () => {
  if (process.env.NODE_ENV !== "production") {
    return;
  }
  Array.prototype.at = function (index) {
    if (index < 0) {
      index = this.length - +index;
    }
    return this[index];
  };
};
