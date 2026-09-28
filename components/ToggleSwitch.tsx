import React from 'react';

interface ToggleSwitchProps {
  label?: string;
  checked?: boolean;
  enabled?: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  activeColor?: string;
  className?: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ 
  label, 
  checked, 
  enabled, 
  onChange, 
  disabled = false, 
  id = 'toggle-switch',
  activeColor = 'bg-purple-600',
  className = ''
}) => {
  const isChecked = Boolean(checked !== undefined ? checked : enabled);

  return (
    <div className={`inline-flex items-center gap-2 ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
      {label && (
        <label 
          htmlFor={id} 
          onClick={() => !disabled && onChange(!isChecked)}
          className="font-medium text-gray-300 text-xs sm:text-sm cursor-pointer select-none"
        >
          {label}
        </label>
      )}
      <button
        id={id}
        type="button"
        onClick={() => !disabled && onChange(!isChecked)}
        className={`${
          isChecked ? activeColor : 'bg-gray-700'
        } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:cursor-not-allowed`}
        role="switch"
        aria-checked={isChecked}
        disabled={disabled}
      >
        <span
          aria-hidden="true"
          className={`${
            isChecked ? 'translate-x-5 bg-white shadow-md' : 'translate-x-0 bg-gray-300'
          } pointer-events-none inline-block h-5 w-5 transform rounded-full ring-0 transition duration-200 ease-in-out`}
        />
      </button>
    </div>
  );
};

export default ToggleSwitch;
