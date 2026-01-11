import React from 'react';
import { View, ViewProps } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';

interface LogoProps extends ViewProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Logo({ size = 'md', className, ...props }: LogoProps) {
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'light'];

  const containerSizes = {
    sm: 'h-10 w-10 rounded-xl',
    md: 'h-16 w-16 rounded-[20px]',
    lg: 'h-24 w-24 rounded-[32px]',
    xl: 'h-32 w-32 rounded-[44px]',
  };

  const iconSizes = {
    sm: 20,
    md: 32,
    lg: 48,
    xl: 64,
  };

  return (
    <View 
      className={`items-center justify-center bg-primary shadow-lg shadow-primary/30 ${containerSizes[size]} ${className}`}
      {...props}
    >
      <View className="absolute inset-0 bg-white/10 rounded-full scale-110 opacity-20" />
      <MapPin size={iconSizes[size]} color="white" fill="white" strokeWidth={2.5} />
    </View>
  );
}
