import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Calculator,
  FileText, 
  Building2, 
  Users, 
  Package, 
  Settings, 
  Plus, 
  Trash2, 
  Eye,
  Printer,
  Save,
  TrendingUp,
  Banknote
} from 'lucide-react';

// Turkish number formatting utility
const formatTurkishCurrency = (amount: number): string => {
  // Handle invalid numbers
  if (!Number.isFinite(amount)) return '₺0,00';
  
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
};

// TCKN validation (improved)
const validateTCKN = (tckn: string): boolean => {
  if (!/^\d{11}$/.test(tckn)) return false;
  
  const digits = tckn.split('').map(Number);
  if (digits[0] === 0) return false;
  
  // TCKN algorithm
  const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
  const evenSum = digits[1] + digits[3] + digits[5] + digits[7];
  const checkDigit1 = ((oddSum * 7) - evenSum) % 10;
  const checkDigit2 = (oddSum + evenSum + digits[9]) % 10;
  
  return digits[9] === checkDigit1 && digits[10] === checkDigit2;
};

// VKN validation (improved)
const validateVKN = (vkn: string): boolean => {
  if (!/^\d{10}$/.test(vkn)) return false;
  
  const digits = vkn.split('').map(Number);
  const weights = [9, 8, 7, 6, 5, 4, 3, 2, 1];
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += digits[i] * weights[i];
  }
  
  const remainder = sum % 11;
  const checkDigit = remainder < 2 ? remainder : 11 - remainder;
  
  return digits[9] === checkDigit;
};

// Safe JSON parser with fallback
const safeJSONParse = (data: string | null, fallback: any): any => {
  if (!data) return fallback;
  
  try {
    const parsed = JSON.parse(data);
    // Validate parsed data structure
    if (typeof parsed !== typeof fallback) return fallback;
    return parsed;
  } catch (error) {
    console.warn('JSON parse error:', error);
    return fallback;
  }
};

// Safe localStorage operations
const safeLocalStorage = {
  getItem: (key: string, fallback: any): any => {
    try {
      const item = localStorage.getItem(key);
      return safeJSONParse(item, fallback);
    } catch (error) {
      console.warn('LocalStorage get error:', error);
      return fallback;
    }
  },
  
  setItem: (key: string, value: any): boolean => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('LocalStorage set error:', error);
      return false;
    }
  }
};

interface Company {
  firmaAdi: string;
  vkn: string;
  vergiDairesi: string;
  adres: string;
  email: string;
  telefon: string;
  seri: string;
  sira: number;
  paraBirimi: string;
  varsayilanKdv: number;
}

interface Customer {
  id: string;
  tip: 'bireysel' | 'kurumsal';
  unvanVeyaAdSoyad: string;
  vknVeyaTckn: string;
  vergiDairesi?: string;
  adres: string;
  email: string;
  telefon: string;
}

interface Product {
  id: string;
  ad: string;
  birim: string;
  birimFiyat: number;
  kdvOran: number;
}

interface InvoiceLine {
  id: string;
  urunAdi: string;
  aciklama: string;
  adet: number;
  birim: string;
  birimFiyat: number;
  iskontoYuzde: number;
  kdvOran: number;
  araToplam: number;
  kdvTutar: number;
  toplam: number;
}

interface Invoice {
  id: string;
  faturaNo: string;
  tarih: string;
  satici: Company;
  alici: Customer;
  satirlar: InvoiceLine[];
  belgeBazliIskontoYuzde: number;
  araToplam: number;
  iskontoToplam: number;
  kdvToplam: number;
  genelToplam: number;
  not: string;
  durum: 'taslak' | 'tamamlandi';
}

const InvoiceApp: React.FC = () => {
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  // Initialize company settings from localStorage
  const [company, setCompany] = useState<Company>(() => 
    safeLocalStorage.getItem('tr-invoice-company', {
      firmaAdi: 'Örnek İşletme',
      vkn: '1234567890',
      vergiDairesi: 'Beyoğlu',
      adres: 'İstiklal Cad. No:1, Beyoğlu/İstanbul',
      email: 'info@ornek.com.tr',
      telefon: '+90 212 555 0123',
      seri: 'A',
      sira: 1,
      paraBirimi: 'TRY',
      varsayilanKdv: 20
    })
  );

  // Initialize data from localStorage
  const [customers, setCustomers] = useState<Customer[]>(() => 
    safeLocalStorage.getItem('tr-invoice-customers', [])
  );
  
  const [products, setProducts] = useState<Product[]>(() => 
    safeLocalStorage.getItem('tr-invoice-products', [
      {
        id: '1',
        ad: 'Danışmanlık Hizmeti',
        birim: 'Saat',
        birimFiyat: 500,
        kdvOran: 20
      }
    ])
  );
  
  const [invoices, setInvoices] = useState<Invoice[]>(() => 
    safeLocalStorage.getItem('tr-invoice-invoices', [])
  );
  const [currentInvoice, setCurrentInvoice] = useState<Invoice>({
    id: '',
    faturaNo: '',
    tarih: new Date().toISOString().split('T')[0],
    satici: company,
    alici: {
      id: '',
      tip: 'kurumsal',
      unvanVeyaAdSoyad: '',
      vknVeyaTckn: '',
      vergiDairesi: '',
      adres: '',
      email: '',
      telefon: ''
    },
    satirlar: [],
    belgeBazliIskontoYuzde: 0,
    araToplam: 0,
    iskontoToplam: 0,
    kdvToplam: 0,
    genelToplam: 0,
    not: '',
    durum: 'taslak'
  });

  const [activeTab, setActiveTab] = useState('fatura');
  const [showPreview, setShowPreview] = useState(false);

  // Save data to localStorage whenever state changes
  useEffect(() => {
    safeLocalStorage.setItem('tr-invoice-company', company);
  }, [company]);

  useEffect(() => {
    safeLocalStorage.setItem('tr-invoice-customers', customers);
  }, [customers]);

  useEffect(() => {
    safeLocalStorage.setItem('tr-invoice-products', products);
  }, [products]);

  useEffect(() => {
    safeLocalStorage.setItem('tr-invoice-invoices', invoices);
  }, [invoices]);

  // Calculate invoice totals with useMemo for performance
  const calculatedInvoice = useMemo(() => {
    let araToplam = 0;
    
    const updatedLines = currentInvoice.satirlar.map(line => {
      const satirAraToplam = line.adet * line.birimFiyat;
      const satirIskontoTutar = satirAraToplam * (line.iskontoYuzde / 100);
      const satirNetTutar = satirAraToplam - satirIskontoTutar;
      const satirKdvTutar = satirNetTutar * (line.kdvOran / 100);
      const satirToplam = satirNetTutar + satirKdvTutar;

      araToplam += satirNetTutar;

      return {
        ...line,
        araToplam: satirAraToplam,
        kdvTutar: satirKdvTutar,
        toplam: satirToplam
      };
    });

    const belgeIskontoTutar = araToplam * (currentInvoice.belgeBazliIskontoYuzde / 100);
    const netAraToplam = araToplam - belgeIskontoTutar;
    const kdvToplam = updatedLines.reduce((total, line) => total + line.kdvTutar, 0);
    const genelToplam = netAraToplam + kdvToplam;

    return {
      satirlar: updatedLines,
      araToplam: netAraToplam,
      iskontoToplam: belgeIskontoTutar,
      kdvToplam,
      genelToplam: Math.round(genelToplam * 100) / 100
    };
  }, [currentInvoice.satirlar, currentInvoice.belgeBazliIskontoYuzde]);

  // Update current invoice when calculations change
  useEffect(() => {
    setCurrentInvoice(prev => ({
      ...prev,
      ...calculatedInvoice
    }));
  }, [calculatedInvoice]);

  // Add new line to invoice
  const addInvoiceLine = () => {
    const newLine: InvoiceLine = {
      id: Date.now().toString(),
      urunAdi: '',
      aciklama: '',
      adet: 1,
      birim: 'Adet',
      birimFiyat: 0,
      iskontoYuzde: 0,
      kdvOran: company.varsayilanKdv,
      araToplam: 0,
      kdvTutar: 0,
      toplam: 0
    };

    setCurrentInvoice(prev => ({
      ...prev,
      satirlar: [...prev.satirlar, newLine]
    }));
  };

  // Update line in invoice with proper typing
  const updateInvoiceLine = useCallback((lineId: string, field: keyof InvoiceLine, value: string | number) => {
    setCurrentInvoice(prev => ({
      ...prev,
      satirlar: prev.satirlar.map(line => 
        line.id === lineId ? { ...line, [field]: value } : line
      )
    }));
  }, []);


  // Remove line from invoice
  const removeLine = useCallback((lineId: string) => {
    setCurrentInvoice(prev => ({
      ...prev,
      satirlar: prev.satirlar.filter(line => line.id !== lineId)
    }));
  }, []);

  // Generate invoice number
  const generateInvoiceNumber = () => {
    const year = new Date().getFullYear();
    const paddedSira = company.sira.toString().padStart(6, '0');
    return `${company.seri}${year}-${paddedSira}`;
  };

  // Reset invoice form
  const resetInvoiceForm = () => {
    setCurrentInvoice({
      id: '',
      faturaNo: '',
      tarih: new Date().toISOString().split('T')[0],
      satici: company,
      alici: {
        id: '',
        tip: 'kurumsal',
        unvanVeyaAdSoyad: '',
        vknVeyaTckn: '',
        vergiDairesi: '',
        adres: '',
        email: '',
        telefon: ''
      },
      satirlar: [],
      belgeBazliIskontoYuzde: 0,
      araToplam: 0,
      iskontoToplam: 0,
      kdvToplam: 0,
      genelToplam: 0,
      not: '',
      durum: 'taslak'
    });
    setShowPreview(false);
  };

  // Enhanced validation functions
  const validateCustomer = (customer: Customer): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (!customer.unvanVeyaAdSoyad.trim()) {
      errors.push('Ünvan/Ad Soyad gereklidir');
    }
    
    if (!customer.vknVeyaTckn.trim()) {
      errors.push('VKN/TCKN gereklidir');
    } else if (customer.tip === 'bireysel') {
      if (!validateTCKN(customer.vknVeyaTckn)) {
        errors.push('Geçersiz TCKN');
      }
    } else if (customer.tip === 'kurumsal') {
      if (!validateVKN(customer.vknVeyaTckn)) {
        errors.push('Geçersiz VKN');
      }
      if (!customer.vergiDairesi?.trim()) {
        errors.push('Vergi dairesi gereklidir');
      }
    }
    
    if (!customer.adres.trim()) {
      errors.push('Adres gereklidir');
    }
    
    if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
      errors.push('Geçersiz e-mail adresi');
    }
    
    return { isValid: errors.length === 0, errors };
  };

  const validateInvoiceLines = (lines: InvoiceLine[]): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (lines.length === 0) {
      errors.push('En az bir ürün/hizmet satırı ekleyin');
      return { isValid: false, errors };
    }
    
    lines.forEach((line, index) => {
      if (!line.urunAdi.trim()) {
        errors.push(`${index + 1}. satır: Ürün adı gereklidir`);
      }
      if (line.adet <= 0) {
        errors.push(`${index + 1}. satır: Adet 0'dan büyük olmalıdır`);
      }
      if (line.birimFiyat < 0) {
        errors.push(`${index + 1}. satır: Birim fiyat negatif olamaz`);
      }
      if (line.kdvOran < 0 || line.kdvOran > 100) {
        errors.push(`${index + 1}. satır: KDV oranı 0-100 arasında olmalıdır`);
      }
    });
    
    return { isValid: errors.length === 0, errors };
  };

  // Save invoice with enhanced validation
  const saveInvoice = useCallback((status: 'taslak' | 'tamamlandi') => {
    // Validate customer
    const customerValidation = validateCustomer(currentInvoice.alici);
    if (!customerValidation.isValid) {
      toast({
        title: "Müşteri Bilgilerinde Hata",
        description: customerValidation.errors.join(', '),
        variant: "destructive",
      });
      return;
    }

    // Validate invoice lines
    const linesValidation = validateInvoiceLines(currentInvoice.satirlar);
    if (!linesValidation.isValid) {
      toast({
        title: "Ürün/Hizmet Satırlarında Hata",
        description: linesValidation.errors.join(', '),
        variant: "destructive",
      });
      return;
    }

    const invoiceToSave = {
      ...currentInvoice,
      id: currentInvoice.id || Date.now().toString(),
      faturaNo: currentInvoice.faturaNo || generateInvoiceNumber(),
      durum: status,
      satici: company
    };

    setInvoices(prev => {
      const existingIndex = prev.findIndex(inv => inv.id === invoiceToSave.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = invoiceToSave;
        return updated;
      }
      return [...prev, invoiceToSave];
    });

    if (status === 'tamamlandi') {
      setCompany(prev => ({ ...prev, sira: prev.sira + 1 }));
      // Reset form after completion using ref to prevent memory leaks
      const timeoutId = setTimeout(() => {
        resetInvoiceForm();
      }, 1500);
      
      // Cleanup on unmount
      return () => clearTimeout(timeoutId);
    }

    toast({
      title: "Başarılı",
      description: status === 'taslak' ? 'Fatura taslak olarak kaydedildi.' : 'Fatura tamamlandı ve yeni fatura için form sıfırlandı.',
    });
  }, [currentInvoice, company, toast]);

  // Secure print invoice function
  const printInvoice = useCallback(() => {
    if (!printRef.current) return;
    
    try {
      const invoiceNumber = currentInvoice.faturaNo || generateInvoiceNumber();
      
      // Create a safe print content without innerHTML
      const printContent = document.createElement('div');
      const clonedContent = printRef.current.cloneNode(true) as HTMLElement;
      
      // Remove any script tags for security
      const scripts = clonedContent.querySelectorAll('script');
      scripts.forEach(script => script.remove());
      
      printContent.appendChild(clonedContent);
      
      const printWindow = window.open('', '_blank', 'width=800,height=600');
      if (!printWindow) {
        toast({
          title: "Popup Engellendi",
          description: "Tarayıcı popup'ları engelliyor. Lütfen popup engelleyiciyi kapatın.",
          variant: "destructive",
        });
        return;
      }
      
      // Handle cleanup when window is closed
      const checkClosed = setInterval(() => {
        if (printWindow.closed) {
          clearInterval(checkClosed);
        }
      }, 1000);
      
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Fatura - ${invoiceNumber.replace(/[<>]/g, '')}</title>
            <style>
              * { 
                box-sizing: border-box; 
                margin: 0; 
                padding: 0; 
              }
              body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                margin: 0; 
                padding: 20px;
                line-height: 1.6;
                color: #333;
                background: white;
              }
              .print-content {
                max-width: 800px;
                margin: 0 auto;
                background: white;
                padding: 40px;
                border-radius: 8px;
              }
              .invoice-header { 
                text-align: center; 
                margin-bottom: 40px; 
                padding-bottom: 20px;
                border-bottom: 3px solid #0ea5e9;
              }
              .invoice-header h1 {
                font-size: 36px;
                font-weight: bold;
                color: #0ea5e9;
                margin-bottom: 8px;
                letter-spacing: 2px;
              }
              .invoice-header .invoice-number {
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 4px;
              }
              .invoice-header .invoice-date {
                color: #666;
                font-size: 14px;
              }
              .company-customer-grid { 
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 40px;
                margin-bottom: 40px; 
              }
              .info-section h3 {
                font-size: 18px;
                font-weight: bold;
                color: #0ea5e9;
                margin-bottom: 16px;
                padding-bottom: 8px;
                border-bottom: 1px solid #e5e7eb;
              }
              .info-section .company-name,
              .info-section .customer-name {
                font-weight: 600;
                font-size: 16px;
                margin-bottom: 8px;
              }
              .info-section div {
                margin-bottom: 4px;
                font-size: 14px;
                line-height: 1.5;
              }
              .invoice-table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-bottom: 30px;
                font-size: 13px;
              }
              .invoice-table th { 
                background: linear-gradient(135deg, #0ea5e9, #0284c7);
                color: white;
                font-weight: 600;
                padding: 14px 10px;
                text-align: center;
                border: none;
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              }
              .invoice-table td { 
                border: 1px solid #e5e7eb;
                padding: 12px 10px;
                vertical-align: middle;
              }
              .invoice-table tr:nth-child(even) {
                background-color: #f9fafb;
              }
              .invoice-table tr:hover {
                background-color: #f3f4f6;
              }
              .invoice-table .text-right { 
                text-align: right; 
              }
              .invoice-table .text-center { 
                text-align: center; 
              }
              .totals-section { 
                margin-top: 30px;
                display: flex;
                justify-content: flex-end;
              }
              .totals-table {
                min-width: 300px;
                border-collapse: collapse;
              }
              .totals-table td {
                padding: 8px 16px;
                border-bottom: 1px solid #e5e7eb;
              }
              .totals-table .label {
                text-align: left;
                font-weight: 500;
              }
              .totals-table .amount {
                text-align: right;
                font-weight: 600;
                min-width: 120px;
              }
              .totals-table .discount {
                color: #dc2626;
              }
              .totals-table .total-row {
                border-top: 2px solid #0ea5e9;
                border-bottom: 3px double #0ea5e9;
                background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
              }
              .totals-table .total-row td {
                font-size: 16px;
                font-weight: bold;
                color: #0ea5e9;
                padding: 12px 16px;
              }
              .currency { 
                font-family: 'Courier New', monospace;
                font-weight: 600;
              }
              @media print { 
                body { 
                  margin: 0; 
                  padding: 10px;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                } 
                .print-content {
                  padding: 20px;
                  box-shadow: none;
                }
                .no-print { 
                  display: none !important; 
                }
                .invoice-table th {
                  background: #0ea5e9 !important;
                  color: white !important;
                }
                .totals-table .total-row {
                  background: #f0f9ff !important;
                }
              }
            </style>
          </head>
          <body>
            ${printContent.innerHTML}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      
      // Wait for content to load before printing
      setTimeout(() => {
        printWindow.print();
      }, 250);
      
    } catch (error) {
      console.error('Print error:', error);
      toast({
        title: "Yazdırma Hatası",
        description: "Fatura yazdırılırken bir hata oluştu. Lütfen tekrar deneyin.",
        variant: "destructive",
      });
    }
  }, [currentInvoice.faturaNo, toast]);

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="mb-8 text-center animate-fade-in">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 rounded-full bg-gradient-primary">
              <FileText className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              TR Fatura Uygulaması
            </h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Profesyonel fatura düzenleme ve yönetim sistemi
          </p>
        </div>

        {/* Main App */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 shadow-business">
            <TabsTrigger value="fatura" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Fatura
            </TabsTrigger>
            <TabsTrigger value="taslaklar" className="flex items-center gap-2">
              <Save className="w-4 h-4" />
              Taslaklar
            </TabsTrigger>
            <TabsTrigger value="urunler" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Ürün/Hizmet
            </TabsTrigger>
            <TabsTrigger value="musteriler" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Müşteriler
            </TabsTrigger>
            <TabsTrigger value="ayarlar" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Ayarlar
            </TabsTrigger>
          </TabsList>

          {/* Invoice Creation Tab */}
          <TabsContent value="fatura" className="space-y-6 animate-slide-up">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Customer Information */}
              <Card className="lg:col-span-2 shadow-soft">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-primary" />
                    Müşteri Bilgileri
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Müşteri Tipi</Label>
                      <Select 
                        value={currentInvoice.alici.tip} 
                        onValueChange={(value: 'bireysel' | 'kurumsal') => 
                          setCurrentInvoice(prev => ({
                            ...prev,
                            alici: { ...prev.alici, tip: value }
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="kurumsal">Kurumsal</SelectItem>
                          <SelectItem value="bireysel">Bireysel</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>
                        {currentInvoice.alici.tip === 'bireysel' ? 'Ad Soyad' : 'Ünvan'}
                      </Label>
                      <Input 
                        value={currentInvoice.alici.unvanVeyaAdSoyad}
                        onChange={(e) => 
                          setCurrentInvoice(prev => ({
                            ...prev,
                            alici: { ...prev.alici, unvanVeyaAdSoyad: e.target.value }
                          }))
                        }
                        placeholder={currentInvoice.alici.tip === 'bireysel' ? 'Ahmet Yılmaz' : 'ABC Ltd. Şti.'}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>
                        {currentInvoice.alici.tip === 'bireysel' ? 'TCKN' : 'VKN'}
                      </Label>
                      <Input 
                        value={currentInvoice.alici.vknVeyaTckn}
                        onChange={(e) => 
                          setCurrentInvoice(prev => ({
                            ...prev,
                            alici: { ...prev.alici, vknVeyaTckn: e.target.value }
                          }))
                        }
                        placeholder={currentInvoice.alici.tip === 'bireysel' ? '12345678901' : '1234567890'}
                        maxLength={currentInvoice.alici.tip === 'bireysel' ? 11 : 10}
                      />
                    </div>
                    {currentInvoice.alici.tip === 'kurumsal' && (
                      <div>
                        <Label>Vergi Dairesi</Label>
                        <Input 
                          value={currentInvoice.alici.vergiDairesi || ''}
                          onChange={(e) => 
                            setCurrentInvoice(prev => ({
                              ...prev,
                              alici: { ...prev.alici, vergiDairesi: e.target.value }
                            }))
                          }
                          placeholder="Beyoğlu"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <Label>Adres</Label>
                    <Textarea 
                      value={currentInvoice.alici.adres}
                      onChange={(e) => 
                        setCurrentInvoice(prev => ({
                          ...prev,
                          alici: { ...prev.alici, adres: e.target.value }
                        }))
                      }
                      placeholder="Tam adres bilgisi..."
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>E-posta</Label>
                      <Input 
                        type="email"
                        value={currentInvoice.alici.email}
                        onChange={(e) => 
                          setCurrentInvoice(prev => ({
                            ...prev,
                            alici: { ...prev.alici, email: e.target.value }
                          }))
                        }
                        placeholder="ornek@email.com"
                      />
                    </div>
                    <div>
                      <Label>Telefon</Label>
                      <Input 
                        value={currentInvoice.alici.telefon}
                        onChange={(e) => 
                          setCurrentInvoice(prev => ({
                            ...prev,
                            alici: { ...prev.alici, telefon: e.target.value }
                          }))
                        }
                        placeholder="+90 555 123 4567"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Invoice Summary */}
              <Card className="shadow-soft">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-accent" />
                    Fatura Özeti
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Fatura No</Label>
                    <Input 
                      value={currentInvoice.faturaNo || generateInvoiceNumber()}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                  <div>
                    <Label>Tarih</Label>
                    <Input 
                      type="date"
                      value={currentInvoice.tarih}
                      onChange={(e) => 
                        setCurrentInvoice(prev => ({ ...prev, tarih: e.target.value }))
                      }
                    />
                  </div>
                  
                  <div className="space-y-2 p-4 bg-gradient-subtle rounded-lg">
                    <div className="flex justify-between">
                      <span>Ara Toplam:</span>
                      <span className="turkish-currency font-medium">
                        {formatTurkishCurrency(currentInvoice.araToplam)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>İskonto:</span>
                      <span className="turkish-currency text-destructive">
                        -{formatTurkishCurrency(currentInvoice.iskontoToplam)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>KDV:</span>
                      <span className="turkish-currency font-medium">
                        {formatTurkishCurrency(currentInvoice.kdvToplam)}
                      </span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t pt-2">
                      <span>Genel Toplam:</span>
                      <span className="turkish-currency text-primary">
                        {formatTurkishCurrency(currentInvoice.genelToplam)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button 
                      variant="success" 
                      onClick={() => saveInvoice('tamamlandi')}
                      className="w-full"
                    >
                      <TrendingUp className="w-4 h-4" />
                      Faturayı Tamamla
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => saveInvoice('taslak')}
                      className="w-full"
                    >
                      <Save className="w-4 h-4" />
                      Taslak Kaydet
                    </Button>
                    <Button 
                      variant="business" 
                      onClick={() => setShowPreview(!showPreview)}
                      className="w-full"
                    >
                      <Eye className="w-4 h-4" />
                      {showPreview ? 'Düzenlemeyi Göster' : 'Önizleme'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Invoice Lines */}
            {!showPreview && (
              <Card className="shadow-soft animate-slide-up">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Package className="w-5 h-5 text-accent" />
                      Ürün / Hizmet Satırları
                    </CardTitle>
                    <Button variant="invoice" onClick={addInvoiceLine}>
                      <Plus className="w-4 h-4" />
                      Satır Ekle
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {currentInvoice.satirlar.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Henüz ürün/hizmet satırı eklenmemiş.</p>
                      <p className="text-sm">Başlamak için "Satır Ekle" butonunu kullanın.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Ürün/Hizmet</th>
                            <th className="text-left p-2">Adet</th>
                            <th className="text-left p-2">Birim</th>
                            <th className="text-right p-2">Birim Fiyat</th>
                            <th className="text-right p-2">İskonto %</th>
                            <th className="text-right p-2">KDV %</th>
                            <th className="text-right p-2">Toplam</th>
                            <th className="text-center p-2">İşlem</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentInvoice.satirlar.map((line) => (
                            <tr key={line.id} className="border-b">
                              <td className="p-2">
                                <div className="space-y-2">
                                   <Select 
                                     value={line.urunAdi || ""}
                                    onValueChange={(productName) => {
                                      if (!productName) return;
                                      
                                      const selectedProduct = products.find(p => p.ad === productName);
                                      if (selectedProduct) {
                                        updateInvoiceLine(line.id, 'urunAdi', selectedProduct.ad);
                                        updateInvoiceLine(line.id, 'birim', selectedProduct.birim);
                                        updateInvoiceLine(line.id, 'birimFiyat', selectedProduct.birimFiyat);
                                        updateInvoiceLine(line.id, 'kdvOran', selectedProduct.kdvOran);
                                      } else {
                                        updateInvoiceLine(line.id, 'urunAdi', productName);
                                      }
                                    }}
                                   >
                                     <SelectTrigger className="min-w-[200px]">
                                       <SelectValue placeholder="Ürün seçin veya manuel girin" />
                                     </SelectTrigger>
                                     <SelectContent>
                                       {products.map((product) => (
                                         <SelectItem key={product.id} value={product.ad}>
                                           {product.ad} - {formatTurkishCurrency(product.birimFiyat)}
                                         </SelectItem>
                                       ))}
                                     </SelectContent>
                                   </Select>
                                  <Input 
                                    value={line.urunAdi}
                                    onChange={(e) => updateInvoiceLine(line.id, 'urunAdi', e.target.value)}
                                    placeholder="Manuel ürün/hizmet adı"
                                    className="min-w-[200px]"
                                  />
                                </div>
                              </td>
                              <td className="p-2">
                                <Input 
                                  type="number"
                                  value={line.adet}
                                  onChange={(e) => updateInvoiceLine(line.id, 'adet', parseFloat(e.target.value) || 0)}
                                  className="w-20"
                                  min="0"
                                  step="0.01"
                                />
                              </td>
                              <td className="p-2">
                                <Select 
                                  value={line.birim} 
                                  onValueChange={(value) => updateInvoiceLine(line.id, 'birim', value)}
                                >
                                  <SelectTrigger className="w-24">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Adet">Adet</SelectItem>
                                    <SelectItem value="Saat">Saat</SelectItem>
                                    <SelectItem value="Gün">Gün</SelectItem>
                                    <SelectItem value="Kg">Kg</SelectItem>
                                    <SelectItem value="Lt">Lt</SelectItem>
                                    <SelectItem value="M">M</SelectItem>
                                    <SelectItem value="M2">M²</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="p-2 text-right">
                                <Input 
                                  type="number"
                                  value={line.birimFiyat}
                                  onChange={(e) => updateInvoiceLine(line.id, 'birimFiyat', parseFloat(e.target.value) || 0)}
                                  className="w-32 text-right"
                                  min="0"
                                  step="0.01"
                                />
                              </td>
                              <td className="p-2 text-right">
                                <Input 
                                  type="number"
                                  value={line.iskontoYuzde}
                                  onChange={(e) => updateInvoiceLine(line.id, 'iskontoYuzde', parseFloat(e.target.value) || 0)}
                                  className="w-20 text-right"
                                  min="0"
                                  max="100"
                                  step="0.01"
                                />
                              </td>
                              <td className="p-2 text-right">
                                <Select 
                                  value={line.kdvOran.toString()} 
                                  onValueChange={(value) => updateInvoiceLine(line.id, 'kdvOran', parseInt(value))}
                                >
                                  <SelectTrigger className="w-20">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="0">0</SelectItem>
                                    <SelectItem value="1">1</SelectItem>
                                    <SelectItem value="10">10</SelectItem>
                                    <SelectItem value="20">20</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="p-2 text-right font-medium turkish-currency">
                                {formatTurkishCurrency(line.toplam)}
                              </td>
                              <td className="p-2 text-center">
                                <Button 
                                  variant="destructive" 
                                  size="sm"
                                  onClick={() => removeLine(line.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {currentInvoice.satirlar.length > 0 && (
                    <div className="mt-4 flex justify-end">
                      <div className="w-64">
                        <Label>Belge Bazlı İskonto (%)</Label>
                        <Input 
                          type="number"
                          value={currentInvoice.belgeBazliIskontoYuzde}
                          onChange={(e) => {
                           const newValue = parseFloat(e.target.value) || 0;
                           setCurrentInvoice(prev => ({
                             ...prev,
                             belgeBazliIskontoYuzde: Math.max(0, Math.min(100, newValue))
                           }));
                         }}
                          className="text-right"
                          min="0"
                          max="100"
                          step="0.01"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Invoice Preview */}
            {showPreview && (
              <Card className="shadow-elegant animate-bounce-in">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="w-5 h-5 text-primary" />
                      Fatura Önizleme
                    </CardTitle>
                    <Button variant="business" onClick={printInvoice}>
                      <Printer className="w-4 h-4" />
                      Yazdır
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div ref={printRef} className="print-content bg-white p-8 rounded-lg">
                    {/* Invoice Header */}
                    <div className="invoice-header text-center mb-8">
                      <h1 className="text-3xl font-bold text-primary mb-2">FATURA</h1>
                      <div className="invoice-number text-lg font-medium">{currentInvoice.faturaNo}</div>
                      <div className="invoice-date text-muted-foreground">Tarih: {new Date(currentInvoice.tarih).toLocaleDateString('tr-TR')}</div>
                    </div>

                    {/* Company and Customer Info */}
                    <div className="company-customer-grid grid grid-cols-2 gap-8 mb-8">
                      <div className="info-section">
                        <h3 className="font-bold text-lg mb-3 text-primary">Satıcı Bilgileri</h3>
                        <div className="space-y-1">
                          <div className="company-name font-medium">{company.firmaAdi}</div>
                          <div>VKN: {company.vkn}</div>
                          <div>Vergi Dairesi: {company.vergiDairesi}</div>
                          <div>{company.adres}</div>
                          <div>{company.email}</div>
                          <div>{company.telefon}</div>
                        </div>
                      </div>
                      <div className="info-section">
                        <h3 className="font-bold text-lg mb-3 text-primary">Alıcı Bilgileri</h3>
                        <div className="space-y-1">
                          <div className="customer-name font-medium">{currentInvoice.alici.unvanVeyaAdSoyad}</div>
                          <div>
                            {currentInvoice.alici.tip === 'bireysel' ? 'TCKN' : 'VKN'}: {currentInvoice.alici.vknVeyaTckn}
                          </div>
                          {currentInvoice.alici.vergiDairesi && (
                            <div>Vergi Dairesi: {currentInvoice.alici.vergiDairesi}</div>
                          )}
                          <div>{currentInvoice.alici.adres}</div>
                          <div>{currentInvoice.alici.email}</div>
                          <div>{currentInvoice.alici.telefon}</div>
                        </div>
                      </div>
                    </div>

                    {/* Invoice Table */}
                    <table className="invoice-table w-full border-collapse mb-6">
                      <thead>
                        <tr>
                          <th className="text-left">Ürün/Hizmet</th>
                          <th className="text-center">Adet</th>
                          <th className="text-center">Birim</th>
                          <th className="text-right">Birim Fiyat</th>
                          <th className="text-right">İskonto %</th>
                          <th className="text-right">KDV %</th>
                          <th className="text-right">Toplam</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentInvoice.satirlar.map((line) => (
                          <tr key={line.id}>
                            <td>{line.urunAdi}</td>
                            <td className="text-center">{line.adet}</td>
                            <td className="text-center">{line.birim}</td>
                            <td className="text-right currency">
                              {formatTurkishCurrency(line.birimFiyat)}
                            </td>
                            <td className="text-right">%{line.iskontoYuzde}</td>
                            <td className="text-right">%{line.kdvOran}</td>
                            <td className="text-right currency">
                              {formatTurkishCurrency(line.toplam)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Totals */}
                    <div className="totals-section">
                      <table className="totals-table">
                        <tbody>
                          <tr>
                            <td className="label">Ara Toplam:</td>
                            <td className="amount currency">{formatTurkishCurrency(currentInvoice.araToplam)}</td>
                          </tr>
                          {currentInvoice.iskontoToplam > 0 && (
                            <tr>
                              <td className="label">İskonto:</td>
                              <td className="amount currency discount">-{formatTurkishCurrency(currentInvoice.iskontoToplam)}</td>
                            </tr>
                          )}
                          <tr>
                            <td className="label">KDV Toplam:</td>
                            <td className="amount currency">{formatTurkishCurrency(currentInvoice.kdvToplam)}</td>
                          </tr>
                          <tr className="total-row">
                            <td className="label">Genel Toplam:</td>
                            <td className="amount currency">
                              {formatTurkishCurrency(currentInvoice.genelToplam)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Notes */}
                    {currentInvoice.not && (
                      <div className="mt-8">
                        <h4 className="font-medium mb-2">Notlar:</h4>
                        <p className="text-sm text-muted-foreground">{currentInvoice.not}</p>
                      </div>
                    )}

                    {/* Signature Area */}
                    <div className="mt-12 grid grid-cols-2 gap-8">
                      <div className="text-center">
                        <div className="border-t border-gray-300 pt-2 mt-16">
                          <span className="text-sm text-muted-foreground">Düzenleyen</span>
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="border-t border-gray-300 pt-2 mt-16">
                          <span className="text-sm text-muted-foreground">Teslim Alan</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Drafts Tab */}
          <TabsContent value="taslaklar" className="space-y-6 animate-slide-up">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Save className="w-5 h-5 text-primary" />
                  Kaydedilen Taslaklar
                </CardTitle>
              </CardHeader>
              <CardContent>
                {invoices.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Henüz kaydedilmiş taslak yok.</p>
                    <p className="text-sm">Fatura sekmesinden taslak kaydedebilirsiniz.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {invoices.map((invoice) => (
                      <div key={invoice.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant={invoice.durum === 'tamamlandi' ? 'default' : 'secondary'}>
                                {invoice.durum === 'tamamlandi' ? 'Tamamlandı' : 'Taslak'}
                              </Badge>
                              <span className="font-medium">{invoice.faturaNo || 'Henüz numara verilmemiş'}</span>
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <div>Müşteri: {invoice.alici.unvanVeyaAdSoyad}</div>
                              <div>Tarih: {new Date(invoice.tarih).toLocaleDateString('tr-TR')}</div>
                              <div>Tutar: <span className="turkish-currency font-medium">{formatTurkishCurrency(invoice.genelToplam)}</span></div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setCurrentInvoice(invoice);
                                setActiveTab('fatura');
                                toast({
                                  title: "Taslak Yüklendi",
                                  description: "Taslak düzenleme için yüklendi."
                                });
                              }}
                            >
                              <Eye className="w-4 h-4" />
                              Düzenle
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => {
                                setInvoices(prev => prev.filter(inv => inv.id !== invoice.id));
                                toast({
                                  title: "Taslak Silindi",
                                  description: "Taslak başarıyla silindi."
                                });
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Products/Services Tab */}
          <TabsContent value="urunler" className="space-y-6 animate-slide-up">
            <Card className="shadow-soft">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-primary" />
                    Ürün/Hizmet Kartları
                  </CardTitle>
                  <Button variant="invoice" onClick={() => {
                    const newProduct: Product = {
                      id: Date.now().toString(),
                      ad: '',
                      birim: 'Adet',
                      birimFiyat: 0,
                      kdvOran: company.varsayilanKdv
                    };
                    setProducts(prev => [...prev, newProduct]);
                  }}>
                    <Plus className="w-4 h-4" />
                    Yeni Ürün/Hizmet
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {products.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Henüz ürün/hizmet kartı eklenmemiş.</p>
                    <p className="text-sm">Başlamak için "Yeni Ürün/Hizmet" butonunu kullanın.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {products.map((product) => (
                      <Card key={product.id} className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <Label>Ürün/Hizmet Adı</Label>
                            <Input 
                              value={product.ad}
                              onChange={(e) => 
                                setProducts(prev => prev.map(p => 
                                  p.id === product.id ? { ...p, ad: e.target.value } : p
                                ))
                              }
                              placeholder="Danışmanlık Hizmeti"
                            />
                          </div>
                          <div>
                            <Label>Birim</Label>
                            <Select 
                              value={product.birim} 
                              onValueChange={(value) => 
                                setProducts(prev => prev.map(p => 
                                  p.id === product.id ? { ...p, birim: value } : p
                                ))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Adet">Adet</SelectItem>
                                <SelectItem value="Saat">Saat</SelectItem>
                                <SelectItem value="Gün">Gün</SelectItem>
                                <SelectItem value="Kg">Kg</SelectItem>
                                <SelectItem value="Lt">Lt</SelectItem>
                                <SelectItem value="M">M</SelectItem>
                                <SelectItem value="M2">M²</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Birim Fiyat</Label>
                            <Input 
                              type="number"
                              value={product.birimFiyat}
                              onChange={(e) => 
                                setProducts(prev => prev.map(p => 
                                  p.id === product.id ? { ...p, birimFiyat: parseFloat(e.target.value) || 0 } : p
                                ))
                              }
                              min="0"
                              step="0.01"
                            />
                          </div>
                          <div>
                            <Label>KDV Oranı (%)</Label>
                            <div className="flex gap-2">
                              <Select 
                                value={product.kdvOran.toString()} 
                                onValueChange={(value) => 
                                  setProducts(prev => prev.map(p => 
                                    p.id === product.id ? { ...p, kdvOran: parseInt(value) } : p
                                  ))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="0">0</SelectItem>
                                  <SelectItem value="1">1</SelectItem>
                                  <SelectItem value="10">10</SelectItem>
                                  <SelectItem value="20">20</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button 
                                variant="destructive" 
                                size="sm"
                                onClick={() => 
                                  setProducts(prev => prev.filter(p => p.id !== product.id))
                                }
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Customers Tab */}
          <TabsContent value="musteriler" className="space-y-6 animate-slide-up">
            <Card className="shadow-soft">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    Müşteri Kartları
                  </CardTitle>
                  <Button variant="invoice" onClick={() => {
                    const newCustomer: Customer = {
                      id: Date.now().toString(),
                      tip: 'kurumsal',
                      unvanVeyaAdSoyad: '',
                      vknVeyaTckn: '',
                      vergiDairesi: '',
                      adres: '',
                      email: '',
                      telefon: ''
                    };
                    setCustomers(prev => [...prev, newCustomer]);
                  }}>
                    <Plus className="w-4 h-4" />
                    Yeni Müşteri
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {customers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Henüz müşteri kartı eklenmemiş.</p>
                    <p className="text-sm">Başlamak için "Yeni Müşteri" butonunu kullanın.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {customers.map((customer) => (
                      <Card key={customer.id} className="p-4">
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <Label>Müşteri Tipi</Label>
                              <Select 
                                value={customer.tip} 
                                onValueChange={(value: 'bireysel' | 'kurumsal') => 
                                  setCustomers(prev => prev.map(c => 
                                    c.id === customer.id ? { ...c, tip: value } : c
                                  ))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="kurumsal">Kurumsal</SelectItem>
                                  <SelectItem value="bireysel">Bireysel</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>{customer.tip === 'bireysel' ? 'Ad Soyad' : 'Ünvan'}</Label>
                              <Input 
                                value={customer.unvanVeyaAdSoyad}
                                onChange={(e) => 
                                  setCustomers(prev => prev.map(c => 
                                    c.id === customer.id ? { ...c, unvanVeyaAdSoyad: e.target.value } : c
                                  ))
                                }
                                placeholder={customer.tip === 'bireysel' ? 'Ahmet Yılmaz' : 'ABC Ltd. Şti.'}
                              />
                            </div>
                            <div>
                              <Label>{customer.tip === 'bireysel' ? 'TCKN' : 'VKN'}</Label>
                              <Input 
                                value={customer.vknVeyaTckn}
                                onChange={(e) => 
                                  setCustomers(prev => prev.map(c => 
                                    c.id === customer.id ? { ...c, vknVeyaTckn: e.target.value } : c
                                  ))
                                }
                                placeholder={customer.tip === 'bireysel' ? '12345678901' : '1234567890'}
                                maxLength={customer.tip === 'bireysel' ? 11 : 10}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {customer.tip === 'kurumsal' && (
                              <div>
                                <Label>Vergi Dairesi</Label>
                                <Input 
                                  value={customer.vergiDairesi || ''}
                                  onChange={(e) => 
                                    setCustomers(prev => prev.map(c => 
                                      c.id === customer.id ? { ...c, vergiDairesi: e.target.value } : c
                                    ))
                                  }
                                  placeholder="Beyoğlu"
                                />
                              </div>
                            )}
                            <div>
                              <Label>E-posta</Label>
                              <Input 
                                type="email"
                                value={customer.email}
                                onChange={(e) => 
                                  setCustomers(prev => prev.map(c => 
                                    c.id === customer.id ? { ...c, email: e.target.value } : c
                                  ))
                                }
                                placeholder="ornek@email.com"
                              />
                            </div>
                            <div>
                              <Label>Telefon</Label>
                              <Input 
                                value={customer.telefon}
                                onChange={(e) => 
                                  setCustomers(prev => prev.map(c => 
                                    c.id === customer.id ? { ...c, telefon: e.target.value } : c
                                  ))
                                }
                                placeholder="+90 555 123 4567"
                              />
                            </div>
                          </div>
                          <div>
                            <Label>Adres</Label>
                            <div className="flex gap-2">
                              <Textarea 
                                value={customer.adres}
                                onChange={(e) => 
                                  setCustomers(prev => prev.map(c => 
                                    c.id === customer.id ? { ...c, adres: e.target.value } : c
                                  ))
                                }
                                placeholder="Tam adres bilgisi..."
                                rows={2}
                                className="flex-1"
                              />
                              <div className="flex flex-col gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => {
                                    setCurrentInvoice(prev => ({
                                      ...prev,
                                      alici: customer
                                    }));
                                    setActiveTab('fatura');
                                    toast({
                                      title: "Müşteri Seçildi",
                                      description: "Müşteri fatura formuna aktarıldı."
                                    });
                                  }}
                                >
                                  <Eye className="w-4 h-4" />
                                  Seç
                                </Button>
                                <Button 
                                  variant="destructive" 
                                  size="sm"
                                  onClick={() => 
                                    setCustomers(prev => prev.filter(c => c.id !== customer.id))
                                  }
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="ayarlar" className="space-y-6 animate-slide-up">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary" />
                  Firma Ayarları
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Firma Adı</Label>
                    <Input 
                      value={company.firmaAdi}
                      onChange={(e) => setCompany(prev => ({ ...prev, firmaAdi: e.target.value }))}
                      placeholder="Örnek İşletme"
                    />
                  </div>
                  <div>
                    <Label>VKN</Label>
                    <Input 
                      value={company.vkn}
                      onChange={(e) => setCompany(prev => ({ ...prev, vkn: e.target.value }))}
                      placeholder="1234567890"
                      maxLength={10}
                    />
                  </div>
                  <div>
                    <Label>Vergi Dairesi</Label>
                    <Input 
                      value={company.vergiDairesi}
                      onChange={(e) => setCompany(prev => ({ ...prev, vergiDairesi: e.target.value }))}
                      placeholder="Beyoğlu"
                    />
                  </div>
                  <div>
                    <Label>E-posta</Label>
                    <Input 
                      type="email"
                      value={company.email}
                      onChange={(e) => setCompany(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="info@ornek.com.tr"
                    />
                  </div>
                  <div>
                    <Label>Telefon</Label>
                    <Input 
                      value={company.telefon}
                      onChange={(e) => setCompany(prev => ({ ...prev, telefon: e.target.value }))}
                      placeholder="+90 212 555 0123"
                    />
                  </div>
                  <div>
                    <Label>Para Birimi</Label>
                    <Select 
                      value={company.paraBirimi} 
                      onValueChange={(value) => setCompany(prev => ({ ...prev, paraBirimi: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TRY">TRY - Türk Lirası</SelectItem>
                        <SelectItem value="USD">USD - ABD Doları</SelectItem>
                        <SelectItem value="EUR">EUR - Euro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div>
                  <Label>Adres</Label>
                  <Textarea 
                    value={company.adres}
                    onChange={(e) => setCompany(prev => ({ ...prev, adres: e.target.value }))}
                    placeholder="İstiklal Cad. No:1, Beyoğlu/İstanbul"
                    rows={3}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Fatura Serisi</Label>
                    <Input 
                      value={company.seri}
                      onChange={(e) => setCompany(prev => ({ ...prev, seri: e.target.value.toUpperCase() }))}
                      placeholder="A"
                      maxLength={3}
                    />
                  </div>
                  <div>
                    <Label>Sıra Numarası</Label>
                    <Input 
                      type="number"
                      value={company.sira}
                      onChange={(e) => setCompany(prev => ({ ...prev, sira: parseInt(e.target.value) || 1 }))}
                      min="1"
                    />
                  </div>
                  <div>
                    <Label>Varsayılan KDV (%)</Label>
                    <Select 
                      value={company.varsayilanKdv.toString()} 
                      onValueChange={(value) => setCompany(prev => ({ ...prev, varsayilanKdv: parseInt(value) }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0</SelectItem>
                        <SelectItem value="1">1</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="pt-4 border-t">
                  <Button 
                    variant="success" 
                    onClick={() => {
                      // Update current invoice's seller info when company settings change
                      setCurrentInvoice(prev => ({
                        ...prev,
                        satici: company
                      }));
                      toast({
                        title: "Ayarlar Kaydedildi",
                        description: "Firma ayarları başarıyla güncellendi."
                      });
                    }}
                    className="w-full"
                  >
                    <Save className="w-4 h-4" />
                    Ayarları Kaydet
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default InvoiceApp;