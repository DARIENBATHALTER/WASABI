import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpiral } from '@fortawesome/free-solid-svg-icons';

interface SpiralIconProps {
  size?: number;
  className?: string;
}

export const SpiralIcon = ({ size = 24, className = "" }: SpiralIconProps) => (
  <FontAwesomeIcon 
    icon={faSpiral} 
    className={className}
    style={{ width: size, height: size }}
  />
);