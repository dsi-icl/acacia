/**
 * LXD related types
 */

interface LxdInstanceUsageProp {
  usage: number;
}

interface LxdInstanceMemory {
  swap_usage: number;
  swap_usage_peak: number;
  usage: number;
  usage_peak: number;
}

interface LxdInstanceNetworkAddress {
  address: string;
  family: string;
  netmask: string;
  scope: string;
}

interface LxdInstanceNetworkCounters {
  bytes_received: number;
  bytes_sent: number;
  errors_received: number;
  errors_sent: number;
  packets_dropped_inbound: number;
  packets_dropped_outbound: number;
  packets_received: number;
  packets_sent: number;
}

interface LxdInstanceNetwork {
  addresses: LxdInstanceNetworkAddress[];
  counters: LxdInstanceNetworkCounters;
  host_name: string;
  hwaddr: string;
  mtu: number;
  state: 'up' | 'down';
  type: string;
}

export interface LXDInstanceState {
  cpu: LxdInstanceUsageProp;
  disk: {
    root: LxdInstanceUsageProp;
  } & Record<string, LxdInstanceUsageProp>;
  memory: LxdInstanceMemory;
  network?: Record<string, LxdInstanceNetwork>;
  pid: number;
  processes: number;
  status: string;
}

export enum LXDInstanceTypeEnum {
    CONTAINER = 'container',
    VIRTUAL_MACHINE = 'virtual-machine',
}

export interface LXDInstanceType {
    name: string;
    description: string;
    status: string;
    statusCode: number;
    profiles: string[];
    type: LXDInstanceTypeEnum;
    architecture: string;
    creationDate: string;
    lastUsedDate: string;
    username: string;
    cpuLimit: string;
    memoryLimit: string;
    key: string;
}

export interface LxdConfiguration {
    name: string;
    architecture: string;
    config?: {
        'limits.cpu': string,
        'limits.memory': string,
        'user.username': string, // store username to instance config
        'user.user-data': string // set the cloud-init user-data
    };
    source: {
        type: string;
        alias: string;
    };
    profiles?: string[];
    type?: string;
    project?: string;
}

// resources.d.ts
export interface LxdResources {
    cpu: Cpu;
    gpu: Gpu;
    memory: Memory;
    network: Network;
    pci: Pci;
    storage: Storage;
    system: System;
    usb: Usb;
  }

export interface Cpu {
    architecture: string;
    sockets?: CpuSockets[] | null;
    total: number;
  }

export interface CpuSockets {
    cache?: Cache[] | null;
    cores?: Cores[] | null;
    frequency: number;
    frequency_minimum: number;
    frequency_turbo: number;
    name: string;
    socket: number;
    vendor: string;
  }

export interface Cache {
    level: number;
    size: number;
    type: string;
  }

export interface Cores {
    core: number;
    die: number;
    frequency: number;
    threads?: Threads[] | null;
  }

export interface Threads {
    id: number;
    isolated: boolean;
    numa_node: number;
    online: boolean;
    thread: number;
  }

export interface Gpu {
    cards?: GpuCards[] | null;
    total: number;
  }

export interface GpuCards {
    driver: string;
    driver_version: string;
    drm: Drm;
    mdev?: null;
    numa_node: number;
    nvidia: Nvidia;
    pci_address: string;
    product: string;
    product_id: string;
    sriov: Sriov;
    usb_address: string;
    vendor: string;
    vendor_id: string;
  }

export interface Drm {
    card_device: string;
    card_name: string;
    control_device: string;
    control_name: string;
    id: number;
    render_device: string;
    render_name: string;
  }

export interface Nvidia {
    architecture: string;
    brand: string;
    card_device: string;
    card_name: string;
    cuda_version: string;
    model: string;
    nvrm_version: string;
    uuid: string;
  }

export interface Sriov {
    current_vfs: number;
    maximum_vfs: number;
    vfs?: null;
  }

export interface Memory {
    hugepages_size: number;
    hugepages_total: number;
    hugepages_used: number;
    nodes?: null;
    total: number;
    used: number;
  }

export interface Network {
    cards?: NetworkCards[] | null;
    total: number;
  }

export interface NetworkCards {
    driver: string;
    driver_version: string;
    firmware_version: string;
    numa_node: number;
    pci_address: string;
    ports?: Ports[] | null;
    product: string;
    product_id: string;
    sriov: Sriov;
    usb_address: string;
    vendor: string;
    vendor_id: string;
  }

export interface Ports {
    address: string;
    auto_negotiation: boolean;
    id: string;
    infiniband: Infiniband;
    link_detected: boolean;
    link_duplex: string;
    link_speed: number;
    port: number;
    port_type: string;
    protocol: string;
    supported_modes?: string[] | null;
    supported_ports?: string[] | null;
    transceiver_type: string;
  }

export interface Infiniband {
    issm_device: string;
    issm_name: string;
    mad_device: string;
    mad_name: string;
    verb_device: string;
    verb_name: string;
  }

export interface Pci {
    devices?: PciDevices[] | null;
    total: number;
  }

export interface PciDevices {
    driver: string;
    driver_version: string;
    iommu_group: number;
    numa_node: number;
    pci_address: string;
    product: string;
    product_id: string;
    vendor: string;
    vendor_id: string;
    vpd: Vpd;
  }

export interface Vpd {
    entries: string;
    product_name: string;
  }

export interface Storage {
    disks?: Disks[] | null;
    total: number;
  }

export interface Disks {
    block_size: number;
    device: string;
    device_id: string;
    device_path: string;
    firmware_version: string;
    id: string;
    model: string;
    numa_node: number;
    partitions?: Partitions[] | null;
    pci_address: string;
    read_only: boolean;
    removable: boolean;
    rpm: number;
    serial: string;
    size: number;
    type: string;
    usb_address: string;
    wwn: string;
  }

export interface Partitions {
    device: string;
    id: string;
    partition: number;
    read_only: boolean;
    size: number;
  }

export interface System {
    chassis: Chassis;
    family: string;
    firmware: Firmware;
    motherboard: Motherboard;
    product: string;
    serial: string;
    sku: string;
    type: string;
    uuid: string;
    vendor: string;
    version: string;
  }

export interface Chassis {
    serial: string;
    type: string;
    vendor: string;
    version: string;
  }

export interface Firmware {
    date: string;
    vendor: string;
    version: string;
  }

export interface Motherboard {
    product: string;
    serial: string;
    vendor: string;
    version: string;
  }

export interface Usb {
    devices?: UsbDevices[] | null;
    total: number;
  }

export interface UsbDevices {
    bus_address: number;
    device_address: number;
    interfaces?: Interfaces[] | null;
    product: string;
    product_id: string;
    speed: number;
    vendor: string;
    vendor_id: string;
  }

export interface Interfaces {
    class: string;
    class_id: number;
    driver: string;
    driver_version: string;
    number: number;
    subclass: string;
    subclass_id: number;
  }


export interface LxdOperationMetadata {
    command: string[];
    environment: {
        HOME: string;
        LANG: string;
        PATH: string;
        TERM: string;
        USER: string;
    };
    fds: {
        [key: string]: string;
    };
    interactive: boolean;
}

export interface LxdOperation {
    metadata: {
        class: string;
        created_at: string;
        description: string;
        err: string;
        id: string;
        location: string;
        may_cancel: boolean;
        metadata: LxdOperationMetadata;
        resources: {
            containers: string[];
            instances: string[];
        };
        status: string;
        status_code: number;
        updated_at: string;
    };
    operation: string;
    status: string;
    status_code: number;
    type: string;
}

export interface LxdErrorResponse {
    error: string;
    error_code: number;
    type: string;
}

export type LxdGetInstanceConsoleResponse = {
    operationId: string;
    operationSecrets: { [key: string]: string };
} | {
    error: boolean;
    data: string;
};
export interface InstanceInfo {
    metadata?: {
        running_operation?: string;
    };
}
