import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { cn } from '@/lib/utils';

interface ButtonProps {
  onPress: () => void;
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  loading?: boolean;
  className?: string;
  textClassName?: string;
}

export function Button({
  onPress,
  title,
  variant = 'primary',
  loading = false,
  className,
  textClassName,
}: ButtonProps) {
  const variants = {
    primary: 'bg-primary',
    secondary: 'bg-secondary',
    outline: 'border border-input bg-background',
    ghost: 'bg-transparent',
  };

  const textVariants = {
    primary: 'text-primary-foreground',
    secondary: 'text-secondary-foreground',
    outline: 'text-foreground',
    ghost: 'text-primary',
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.7}
      className={cn(
        'h-12 flex-row items-center justify-center rounded-xl px-4',
        variants[variant],
        loading && 'opacity-70',
        className
      )}>
      {loading ? (
        <ActivityIndicator color="white" />
      ) : (
        <Text className={cn('text-base font-semibold', textVariants[variant], textClassName)}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}
