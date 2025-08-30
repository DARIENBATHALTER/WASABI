import sobaLogo from '../../assets/soba-logo.png';

interface SOBAIconProps {
  size?: number;
  className?: string;
}

export default function SOBAIcon({ size = 72, className = '' }: SOBAIconProps) {
  return (
    <img
      src={sobaLogo}
      alt="SOBA Logo"
      width={size}
      height={size}
      className={`inline-block ${className}`}
      style={{ 
        filter: 'brightness(0) saturate(100%) invert(27%) sepia(51%) saturate(2878%) hue-rotate(192deg) brightness(97%) contrast(97%)'
      }}
    />
  );
}