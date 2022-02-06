export interface IHasLastModifiedDate {
  lastModifiedDate: Date;
}

export interface IHasFileName {
  newFilename: string;
  originalFilename: string;
}

export interface IHasMimetype {
  mimetype: string;
}

export interface IHasHashAlgorithm {
  hashAlgorithm: boolean;
}

export default interface IHasTempFile {
  filepath: string;
}
