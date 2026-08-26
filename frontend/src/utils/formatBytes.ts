export const formatBytes = (value: number) => {
    return value < 1024 * 1024
        ? `${(value / 1024).toFixed(1)} KB`
        : `${(value / 1024 / 1024).toFixed(1)} MB`;
}
