import React from 'react';
import { WARRANTY_PRESETS } from '../../utils/warranty';
import { CustomSelect } from '../ui/CustomSelect';

interface WarrantyFieldsProps {
  value: string;
  onChange: (value: string) => void;
  customValue: string;
  onCustomChange: (value: string) => void;
  customInputClassName?: string;
}

export const WarrantyFields: React.FC<WarrantyFieldsProps> = ({
  value,
  onChange,
  customValue,
  onCustomChange,
  customInputClassName = 'app-field h-11 w-20 px-2 py-2 text-center text-xs placeholder:text-zinc-500 sm:text-sm',
}) => (
  <div>
    <label className="block text-zinc-300 font-medium mb-1 text-xs">Warranty Provided</label>
    <div className="flex gap-2">
      <div className="flex-1">
        <CustomSelect
          value={value}
          onChange={onChange}
          options={[...WARRANTY_PRESETS, { value: 'Custom', label: 'Custom' }]}
          placeholder="Select..."
        />
      </div>
      {value === 'Custom' && (
        <input
          type="number"
          min="1"
          step="1"
          value={customValue}
          onChange={(event) => onCustomChange(event.target.value)}
          className={customInputClassName}
          placeholder="Days"
          required
        />
      )}
    </div>
  </div>
);
