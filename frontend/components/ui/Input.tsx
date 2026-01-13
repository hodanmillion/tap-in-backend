import { TextInput, View, Text, TextInputProps } from 'react-native';
import { cn } from '@/lib/utils';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerClassName?: string;
}

export function Input({ label, error, containerClassName, className, ...props }: InputProps) {
  return (
    <View className={cn('mb-4 gap-1.5', containerClassName)}>
      {label && <Text className="text-sm font-medium text-foreground">{label}</Text>}
        <TextInput
          className={cn(
            'h-14 w-full rounded-2xl border-[0.5px] border-border/50 bg-secondary/30 px-5 text-base text-foreground focus:border-primary',
            error && 'border-destructive',
            className
          )}
          placeholderTextColor="#666"
        {...props}
      />
      {error && <Text className="text-xs font-medium text-destructive">{error}</Text>}
    </View>
  );
}
