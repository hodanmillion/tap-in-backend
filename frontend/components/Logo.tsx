import React from 'react';
import { View, ViewProps } from 'react-native';
import Svg, { Rect, Path, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';

interface LogoProps extends ViewProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'primary' | 'white' | 'glass';
}

export function Logo({ size = 'md', variant = 'primary', className, ...props }: LogoProps) {
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'light'];

  const containerSizes = {
    sm: 40,
    md: 64,
    lg: 96,
    xl: 128,
  };

  const svgSize = containerSizes[size];
  const borderRadius = size === 'sm' ? 12 : size === 'md' ? 20 : size === 'lg' ? 32 : 44;

  // Use a rich gradient for the background when in primary variant
  const bgStyle = variant === 'primary' 
    ? { backgroundColor: 'transparent' } // We'll use a gradient inside Svg or a View
    : variant === 'white' 
      ? { backgroundColor: 'white' }
      : { backgroundColor: 'rgba(255, 255, 255, 0.15)' };

  return (
    <View 
      className={`items-center justify-center ${className}`}
      style={[
        {
          width: svgSize,
          height: svgSize,
          borderRadius: borderRadius,
          ...bgStyle,
          overflow: 'hidden',
        },
        variant === 'primary' && {
          shadowColor: theme.primary,
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.3,
          shadowRadius: 16,
          elevation: 20,
        }
      ]}
      {...props}
    >
      <Svg width="100%" height="100%" viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#6366f1" stopOpacity="1" />
            <Stop offset="100%" stopColor="#4338ca" stopOpacity="1" />
          </LinearGradient>
          <LinearGradient id="iconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
            <Stop offset="100%" stopColor="#E2E8F0" stopOpacity="1" />
          </LinearGradient>
          <LinearGradient id="accentGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#818cf8" stopOpacity="1" />
            <Stop offset="100%" stopColor="#6366f1" stopOpacity="1" />
          </LinearGradient>
        </Defs>

        {/* Background Gradient */}
        {variant === 'primary' && (
          <Rect width="100%" height="100%" fill="url(#bgGradient)" />
        )}

        {/* Single Prominent Location Pin */}
        <G transform="translate(10, 10) scale(0.8)">
          <Path
            d="M50 0C31.2 0 16 15.2 16 34C16 54.7 50 88 50 88C50 88 84 54.7 84 34C84 15.2 68.8 0 50 0ZM50 50C41.2 50 34 42.8 34 34C34 25.2 41.2 18 50 18C58.8 18 66 25.2 66 34C66 42.8 58.8 50 50 50Z"
            fill="url(#iconGradient)"
          />
        </G>
      </Svg>
    </View>
  );
}
