import React from 'react';
import { View, ViewProps } from 'react-native';
import Svg, { Rect, Path, Defs, LinearGradient, Stop, G, Text } from 'react-native-svg';
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
                <Stop offset="0%" stopColor="#1a1a1a" stopOpacity="1" />
                <Stop offset="100%" stopColor="#000000" stopOpacity="1" />
              </LinearGradient>
              <LinearGradient id="iconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                <Stop offset="100%" stopColor="#a1a1a1" stopOpacity="1" />
              </LinearGradient>
            </Defs>

          {/* Background Gradient */}
          {variant === 'primary' && (
            <Rect width="100%" height="100%" fill="url(#bgGradient)" />
          )}

          {/* Bolt / Zap Icon */}
          <G transform="translate(20, 15) scale(0.6)">
            <Path
              d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
              fill="url(#iconGradient)"
              transform="scale(4)"
            />
          </G>
          
            {/* Pro Text */}
            <G transform="translate(50, 80)">
               <Rect x="-22" y="-8" width="44" height="16" rx="4" fill="white" opacity="0.2" />
               <Text
                 x="0"
                 y="4"
                 fill="white"
                 fontSize="10"
                 fontWeight="900"
                 textAnchor="middle"
                 letterSpacing="1"
               >
                 PRO
               </Text>
            </G>

        </Svg>
    </View>
  );
}
