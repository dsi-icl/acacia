declare module NodeJS {
    interface Global {
        hasMinio: string;
        minioContainerPort: number;
    }
}