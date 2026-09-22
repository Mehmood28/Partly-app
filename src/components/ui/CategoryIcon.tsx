import React from 'react';
import {
  Box,
  CircuitBoard,
  Cpu,
  Database,
  Fan,
  HardDrive,
  Monitor,
  Package,
  Zap,
} from 'lucide-react';

interface CategoryIconProps {
  category?: string;
  className?: string;
  fallbackClassName?: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  category,
  className = 'w-4 h-4 text-[#83E5DF]',
  fallbackClassName = className,
}) => {
  switch (category?.toUpperCase()) {
    case 'GPU': return <Monitor className={className} />;
    case 'CPU': return <Cpu className={className} />;
    case 'RAM': return <HardDrive className={className} />;
    case 'STORAGE': return <Database className={className} />;
    case 'MOTHERBOARD': return <CircuitBoard className={className} />;
    case 'PSU': return <Zap className={className} />;
    case 'COOLING':
    case 'FANS': return <Fan className={className} />;
    case 'CASE': return <Box className={className} />;
    default: return <Package className={fallbackClassName} />;
  }
};
