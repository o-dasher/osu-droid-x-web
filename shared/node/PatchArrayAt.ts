export const PatchArrayAt = () => {
  if (process.env.NODE_ENV !== "production") {
    return;
  }
  Array.prototype.at = function (index) {
    return this[index >= 0 ? index : this.length - Math.abs(index)];
  };
};
