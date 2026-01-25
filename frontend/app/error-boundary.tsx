import React from 'react';
import { View, Text, Platform, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';

interface Props {
  children: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

const webTargetOrigins = ['http://localhost:3000', 'https://orchids.app'];

function sendErrorToIframeParent(error: any, errorInfo?: any) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (!error?.stack) {
      return;
    }

    const errorMessage = {
      type: 'ERROR_CAPTURED',
      error: {
        message: error?.message || error?.toString() || 'Unknown error',
        stack: error?.stack,
        componentStack: errorInfo?.componentStack,
        source: 'error-boundary',
      },
      timestamp: Date.now(),
    };

    try {
      window.parent.postMessage(
        errorMessage,
        webTargetOrigins.includes(document.referrer) ? document.referrer : '*'
      );
    } catch (postMessageError) {
      console.error('Failed to send error to parent:', postMessageError);
    }
  }
}

try {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.addEventListener(
      'error',
      (event) => {
        event.preventDefault();
        const errorDetails = event.error ?? {
          message: event.message ?? 'Unknown error',
          filename: event.filename ?? 'Unknown file',
          lineno: event.lineno ?? 'Unknown line',
          colno: event.colno ?? 'Unknown column',
        };
        sendErrorToIframeParent(errorDetails);
      },
      true
    );

    window.addEventListener(
      'unhandledrejection',
      (event) => {
        event.preventDefault();
        sendErrorToIframeParent(event.reason);
      },
      true
    );

    const originalConsoleError = console.error;
    console.error = (...args) => {
      sendErrorToIframeParent(args.join(' '));
      originalConsoleError.apply(console, args);
    };
  }
} catch {}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    sendErrorToIframeParent(error, errorInfo);
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = async () => {
    try {
      await AsyncStorage.clear();
      if (Platform.OS !== 'web') {
        await Updates.reloadAsync();
      } else {
        window.location.reload();
      }
    } catch (e) {
      console.error('Failed to reset app:', e);
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <Text style={{ marginBottom: 12, textAlign: 'center', fontSize: 28, fontWeight: '900', color: 'white' }}>
              Oops! A crash occurred.
            </Text>
              <Text style={{ marginBottom: 24, textAlign: 'center', fontSize: 16, color: '#9ca3af', lineHeight: 24 }}>
                {this.state.error?.message || 'An unexpected error occurred.'}
              </Text>
            
            <TouchableOpacity 
              onPress={this.handleReset}
              style={{ 
                backgroundColor: '#6366f1', 
                paddingVertical: 16, 
                paddingHorizontal: 32, 
                borderRadius: 16,
                shadowColor: '#6366f1',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 5
              }}
            >
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Clear Cache & Restart</Text>
            </TouchableOpacity>

            {Platform.OS !== 'web' && (
              <Text style={{ marginTop: 24, textAlign: 'center', fontSize: 12, color: '#4b5563' }}>
                Technical details have been logged.
              </Text>
            )}
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
