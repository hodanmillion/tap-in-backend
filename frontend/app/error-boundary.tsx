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
        const errorMessage = this.state.error?.message || String(this.state.error) || 'An unexpected error occurred.';
        const errorStack = this.state.error?.stack;

        return (
          <View style={{ flex: 1, backgroundColor: '#1e1b4b' }}>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                <Text style={{ fontSize: 40 }}>⚠️</Text>
              </View>
              
              <Text style={{ marginBottom: 12, textAlign: 'center', fontSize: 24, fontWeight: 'bold', color: 'white' }}>
                TapIn encountered an error
              </Text>
              
              <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 16, marginBottom: 32, width: '100%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                <Text style={{ fontSize: 14, color: '#fca5a5', textAlign: 'center', lineHeight: 20, fontWeight: '500' }}>
                  {errorMessage}
                </Text>
              </View>
              
              <TouchableOpacity 
                onPress={this.handleReset}
                activeOpacity={0.8}
                style={{ 
                  backgroundColor: '#6366f1', 
                  paddingVertical: 18, 
                  paddingHorizontal: 36, 
                  borderRadius: 20,
                  width: '100%',
                  alignItems: 'center',
                  shadowColor: '#6366f1',
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.3,
                  shadowRadius: 15,
                  elevation: 8
                }}
              >
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Force Restart App</Text>
              </TouchableOpacity>
  
              <TouchableOpacity 
                onPress={() => Platform.OS !== 'web' && Updates.reloadAsync()}
                style={{ marginTop: 24, padding: 10 }}
              >
                <Text style={{ color: '#94a3b8', fontSize: 14, fontWeight: '600' }}>Try Soft Reload</Text>
              </TouchableOpacity>

              <Text style={{ position: 'absolute', bottom: 40, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: 0.5 }}>
                SYSTEM ERROR CAPTURED | BUILD 221
              </Text>
            </View>
          </View>
        );
      }

    return this.props.children;
  }
}

export default ErrorBoundary;
