import { 
  MonitorPlay, 
  Cpu, 
  CircuitBoard, 
  MemoryStick, 
  Fan, 
  HardDrive, 
  Zap, 
  Box, 
  CheckCircle2 
} from 'lucide-react';

export const isWhiteComponent = (name: string): boolean => {
  if (!name) return false;
  const upper = name.toUpperCase();
  return upper.includes('WHITE') || 
         upper.includes('SNOW') || 
         upper.includes('SILVER') || 
         upper.includes('STEEL LEGEND') || 
         upper.includes('A-GAMING') || 
         upper.includes(' ICE') || 
         upper.includes('AERO') || 
         upper.includes('VISION');
};

export const isColorCompatible = (category: string, part: { name: string }, theme: 'white' | 'black' | 'any'): boolean => {
  if (theme === 'any') return true;
  const isWhite = isWhiteComponent(part.name);
  
  if (category === 'CPU' || category === 'Storage') return true; // Color doesn't matter
  
  if (theme === 'white') {
    return isWhite;
  } else {
    return !isWhite;
  }
};

export const getCategoryIcon = (cat: string) => {
  const iconClass = 'w-3.5 h-3.5 text-[#83E5DF]';
  switch (cat) {
    case 'GPU': return <MonitorPlay className={iconClass} />;
    case 'CPU': return <Cpu className={iconClass} />;
    case 'Motherboard': return <CircuitBoard className={iconClass} />;
    case 'RAM': return <MemoryStick className={iconClass} />;
    case 'Cooling': return <Fan className={iconClass} />;
    case 'Storage': return <HardDrive className={iconClass} />;
    case 'PSU': return <Zap className={iconClass} />;
    case 'Case': return <Box className={iconClass} />;
    default: return <CheckCircle2 className="w-3.5 h-3.5 text-neutral-500" />;
  }
};

export const formatShortCpuAndGpu = (cpuName: string, gpuName: string): string => {
  let shortCpu = cpuName;
  if (cpuName.toUpperCase().includes('INTEL') || cpuName.toUpperCase().includes('CORE')) {
    const match = cpuName.match(/(i\d-\d{4,5}[a-zA-Z0-9]*|\d{4,5}[a-zA-Z0-9]*)/i);
    if (match) shortCpu = match[0];
  } else {
    const match = cpuName.match(/Ryzen \d \d{4,5}[a-zA-Z0-9]*/i);
    if (match) shortCpu = match[0];
  }
  const shortGpu = gpuName.match(/(RTX|GTX|RX) \d{4}( XT| Ti| Super)?/i)?.[0] || gpuName.split(' ')[0];
  return gpuName ? `${shortCpu} + ${shortGpu}` : `${shortCpu}`;
};
