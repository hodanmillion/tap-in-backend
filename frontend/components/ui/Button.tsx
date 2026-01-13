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
      primary: 'bg-primary shadow-sm active:opacity-90',
      secondary: 'bg-secondary/50 active:bg-secondary/80',
      outline: 'border-[0.5px] border-border bg-background active:bg-secondary/20',
      ghost: 'bg-transparent active:bg-secondary/10',
    };

    const textVariants = {
      primary: 'text-primary-foreground font-bold tracking-tight',
      secondary: 'text-secondary-foreground font-bold tracking-tight',
      outline: 'text-foreground font-bold tracking-tight',
      ghost: 'text-primary font-bold tracking-tight',
    };

    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={loading}
        activeOpacity={0.7}
        className={cn(
          'h-14 flex-row items-center justify-center rounded-2xl px-6',
          variants[variant],
          loading && 'opacity-70',
          className
        )}>
        {loading ? (
          <ActivityIndicator color={variant === 'primary' ? 'black' : 'white'} />
        ) : (
        <Text className={cn('text-base font-semibold', textVariants[variant], textClassName)}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}
