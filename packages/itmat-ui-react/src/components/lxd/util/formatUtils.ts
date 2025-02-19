// src/utils/formatUtils.ts
import { Cpu, Memory, Storage, Gpu} from '@itmat-broker/itmat-types';

// Format CPU information
export const formatCPUInfo = (cpu: Cpu) => {
    if (!cpu.sockets) return 'CPU information not available';
    const coreCount = cpu.sockets.reduce((acc, socket) => acc + (socket.cores ? socket.cores.length : 0), 0);
    return `CPU: ${cpu.total} Socket(s), ${coreCount} Core(s) Total, Architecture: ${cpu.architecture}`;
};

// Format Memory information
export const formatMemoryInfo = (memory: Memory) => {
    return `Total Memory: ${formatBytes(memory.total)}, Used: ${formatBytes(memory.used)}, Free: ${formatBytes(memory.total - memory.used)}`;
};

// Format Storage information
export const formatStorageInfo = (storage: Storage) => {
    if (!storage.disks) return 'Storage information not available';
    const totalSize = storage.disks.reduce((acc, disk) => acc + disk.size, 0);
    return `Storage: ${storage.total} Disk(s), Total Size: ${formatBytes(totalSize)}`;
};

export const formatGPUInfo = (gpu: Gpu) => {
    return `GPU: ${gpu.total} Card(s)`;
};


// Helper function to format bytes into a more readable format
export function formatBytes(bytes: number, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
