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

        {/* Bento Grid Design */}
        <G transform="translate(15, 15) scale(0.7)">
          {/* Top Left: Pin Container */}
          <Rect
            x="0"
            y="0"
            width="45"
            height="45"
            rx="12"
            fill={variant === 'primary' ? 'rgba(255,255,255,0.15)' : theme.primary}
          />
          {/* Pin Icon */}
          <Path
            d="M22.5 10C17.2 10 13 14.2 13 19.5C13 25.3 22.5 35 22.5 35C22.5 35 32 25.3 32 19.5C32 14.2 27.8 10 22.5 10ZM22.5 24C20.1 24 18.1 22 18.1 19.6C18.1 17.2 20.1 15.2 22.5 15.2C24.9 15.2 26.9 17.2 26.9 19.6C26.9 22 24.9 24 22.5 24Z"
            fill="url(#iconGradient)"
          />

          {/* Top Right: Accent Square */}
          <Rect
            x="55"
            y="0"
            width="45"
            height="20"
            rx="8"
            fill="url(#accentGradient)"
            opacity={0.8}
          />
          <Rect
            x="55"
            y="28"
            width="45"
            height="17"
            rx="8"
            fill={variant === 'primary' ? 'rgba(255,255,255,0.1)' : theme.primary}
            opacity={0.6}
          />

          {/* Bottom Left: Info Square */}
          <Rect
            x="0"
            y="55"
            width="45"
            height="45"
            rx="12"
            fill={variant === 'primary' ? 'rgba(255,255,255,0.1)' : theme.primary}
            opacity={0.5}
          />
          <G transform="translate(10, 65)">
             <Rect width="25" height="4" rx="2" fill="white" opacity={0.8} />
             <Rect y="10" width="15" height="4" rx="2" fill="white" opacity={0.6} />
             <Rect y="20" width="20" height="4" rx="2" fill="white" opacity={0.4} />
          </G>

          {/* Bottom Right: Connection Dots */}
          <Rect
            x="55"
            y="55"
            width="45"
            height="45"
            rx="12"
            fill="url(#accentGradient)"
          />
          <G transform="translate(62, 62)">
             <Path 
               d="M5 5C5 5 10 10 15 5M5 15C5 15 10 10 15 15M5 25C5 25 10 20 15 25" 
               stroke="white" 
               strokeWidth="3" 
               strokeLinecap="round" 
               opacity={0.9}
             />
          </G>
        </G>
      </Svg>
    </View>
  );
}
