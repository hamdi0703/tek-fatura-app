import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Invoice App Error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-6">
          <Card className="max-w-lg w-full shadow-elegant">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-3 rounded-full bg-destructive/10">
                  <AlertTriangle className="w-8 h-8 text-destructive" />
                </div>
              </div>
              <CardTitle className="text-destructive">Bir Hata Oluştu</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center text-muted-foreground">
                <p>Fatura uygulamasında beklenmeyen bir hata oluştu.</p>
                <p className="text-sm mt-2">Sayfayı yenilemeyi deneyin veya teknik destek ile iletişime geçin.</p>
              </div>
              
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-4 p-4 bg-muted rounded-md text-sm">
                  <summary className="cursor-pointer font-medium">Teknik Detaylar</summary>
                  <pre className="mt-2 text-xs overflow-auto">
                    {this.state.error.message}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
              
              <div className="flex justify-center">
                <Button 
                  variant="outline" 
                  onClick={() => window.location.reload()}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Sayfayı Yenile
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;