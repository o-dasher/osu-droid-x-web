export const PatchArrayAt = () => {
  if (!Array.prototype.at) {
    Array.prototype.at = function (index) {
      return this[index >= 0 ? index : this.length - Math.abs(index)];
    };
  }
};
