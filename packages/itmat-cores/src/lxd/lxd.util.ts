import {LxdConfiguration} from '@itmat-broker/itmat-types';

// sanitized the update playload
export const sanitizeUpdatePayload = (payload: LxdConfiguration) => {
    const sanitizedPayload: LxdConfiguration = { ...payload };

    // Check if config property exists
    if (sanitizedPayload.config) {
        // Check and format CPU limit
        if (typeof sanitizedPayload.config['limits.cpu'] !== 'string') {
            sanitizedPayload.config['limits.cpu'] = '2'; // Default to '2' if not a string
        } else {
            sanitizedPayload.config['limits.cpu'] = sanitizeCpuLimit(sanitizedPayload.config['limits.cpu']);
        }

        // Check and format memory limit
        if (typeof sanitizedPayload.config['limits.memory'] !== 'string') {
            sanitizedPayload.config['limits.memory'] = '16GB'; // Default to '16GB' if not a string
        } else {
            sanitizedPayload.config['limits.memory'] = sanitizeMemoryLimit(sanitizedPayload.config['limits.memory']);
        }
    }

    return sanitizedPayload;
};

// Sanitize CPU limit
const sanitizeCpuLimit = (cpuLimit: string): string => {
    return cpuLimit ? cpuLimit.toString() : '2'; // Default to '2' if not provided
};

// Sanitize memory limit
const sanitizeMemoryLimit = (memoryLimit: string): string => {
    return memoryLimit ? memoryLimit.toString() : '16GB'; // Default to '16GB' if not provided
};