import React from 'react';
import { View, ViewProps } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
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

  const bgStyle = variant === 'primary' 
    ? { backgroundColor: theme.primary } 
    : variant === 'white' 
      ? { backgroundColor: 'white' }
      : { backgroundColor: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(10px)' };

  return (
    <View 
      className={`items-center justify-center ${className}`}
      style={[
        {
          width: svgSize,
          height: svgSize,
          borderRadius: borderRadius,
          ...bgStyle,
        },
        variant === 'primary' && {
          shadowColor: theme.primary,
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.4,
          shadowRadius: 16,
          elevation: 20,
        }
      ]}
      {...props}
    >
      <Svg width={svgSize * 0.6} height={svgSize * 0.6} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={variant === 'primary' ? '#FFFFFF' : theme.primary} stopOpacity="1" />
            <Stop offset="100%" stopColor={variant === 'primary' ? '#F0F0F0' : theme.primary} stopOpacity="0.8" />
          </LinearGradient>
        </Defs>
        
        {/* Stylized 'T' and Pin combo */}
        <Path
          d="M50 15C33.4 15 20 28.4 20 45C20 63.3 43.3 87.5 45.3 89.6C47.9 92.3 52.1 92.3 54.7 89.6C56.7 87.5 80 63.3 80 45C80 28.4 66.6 15 50 15ZM50 60C41.7 60 35 53.3 35 45C35 36.7 41.7 30 50 30C58.3 30 65 36.7 65 45C65 53.3 58.3 60 50 60Z"
          fill="url(#logoGradient)"
        />
        
        {/* Inner 'T' bar */}
        <Path
          d="M40 40H60V50H40V40Z"
          fill={variant === 'primary' ? theme.primary : '#FFFFFF'}
          opacity={0.9}
        />
        <Path
          d="M45 35H55V60H45V35Z"
          fill={variant === 'primary' ? theme.primary : '#FFFFFF'}
          opacity={0.9}
        />

        {/* Connection Pulse */}
        <Circle cx="50" cy="45" r="5" fill={variant === 'primary' ? theme.primary : '#FFFFFF'} />
      </Svg>
    </View>
  );
}
