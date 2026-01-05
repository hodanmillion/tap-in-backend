import { TextInput, View, Text, TextInputProps } from 'react-native';
import { cn } from '@/lib/utils';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerClassName?: string;
}

export function Input({
  label,
  error,
  containerClassName,
  className,
  ...props
}: InputProps) {
  return (
    <View className={cn('mb-4 gap-1.5', containerClassName)}>
      {label && (
        <Text className="text-sm font-medium text-foreground">{label}</Text>
      )}
      <TextInput
        className={cn(
          'h-12 w-full rounded-xl border border-input bg-background px-4 text-base text-foreground focus:border-primary',
          error && 'border-destructive',
          className
        )}
        placeholderTextColor="#9ca3af"
        {...props}
      />
      {error && (
        <Text className="text-xs font-medium text-destructive">{error}</Text>
      )}
    </View>
  );
}
