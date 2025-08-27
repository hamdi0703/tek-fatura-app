import React, { useState, useRef } from 'react';
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
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

// TCKN validation (basic)
const validateTCKN = (tckn: string): boolean => {
  return /^\d{11}$/.test(tckn);
};

// VKN validation (basic)
const validateVKN = (vkn: string): boolean => {
  return /^\d{10}$/.test(vkn);
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

  // Default company settings
  const [company, setCompany] = useState<Company>({
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
  });

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([
    {
      id: '1',
      ad: 'Danışmanlık Hizmeti',
      birim: 'Saat',
      birimFiyat: 500,
      kdvOran: 20
    }
  ]);
  
  const [invoices, setInvoices] = useState<Invoice[]>([]);
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

  // Calculate invoice totals
  const calculateInvoice = () => {
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

    setCurrentInvoice(prev => ({
      ...prev,
      satirlar: updatedLines,
      araToplam: netAraToplam,
      iskontoToplam: belgeIskontoTutar,
      kdvToplam,
      genelToplam: Math.round(genelToplam * 100) / 100
    }));
  };

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

  // Update line in invoice
  const updateInvoiceLine = (lineId: string, field: keyof InvoiceLine, value: any) => {
    setCurrentInvoice(prev => ({
      ...prev,
      satirlar: prev.satirlar.map(line => 
        line.id === lineId ? { ...line, [field]: value } : line
      )
    }));
    setTimeout(calculateInvoice, 0);
  };

  // Remove line from invoice
  const removeLine = (lineId: string) => {
    setCurrentInvoice(prev => ({
      ...prev,
      satirlar: prev.satirlar.filter(line => line.id !== lineId)
    }));
    setTimeout(calculateInvoice, 0);
  };

  // Generate invoice number
  const generateInvoiceNumber = () => {
    const year = new Date().getFullYear();
    const paddedSira = company.sira.toString().padStart(6, '0');
    return `${company.seri}${year}-${paddedSira}`;
  };

  // Save invoice
  const saveInvoice = (status: 'taslak' | 'tamamlandi') => {
    if (!currentInvoice.alici.unvanVeyaAdSoyad) {
      toast({
        title: "Hata",
        description: "Lütfen müşteri bilgilerini doldurun.",
        variant: "destructive",
      });
      return;
    }

    if (currentInvoice.satirlar.length === 0) {
      toast({
        title: "Hata", 
        description: "Lütfen en az bir ürün/hizmet satırı ekleyin.",
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
    }

    toast({
      title: "Başarılı",
      description: status === 'taslak' ? 'Fatura taslak olarak kaydedildi.' : 'Fatura tamamlandı.',
    });
  };

  // Print invoice
  const printInvoice = () => {
    if (printRef.current) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Fatura - ${currentInvoice.faturaNo}</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .invoice-header { text-align: center; margin-bottom: 30px; }
                .invoice-details { display: flex; justify-content: space-between; margin-bottom: 30px; }
                .invoice-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                .invoice-table th, .invoice-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                .invoice-table th { background-color: #f5f5f5; }
                .totals { margin-top: 20px; text-align: right; }
                .currency { font-weight: bold; color: #d4af37; }
                @media print { body { margin: 0; } }
              </style>
            </head>
            <body>
              ${printRef.current.innerHTML}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

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
                                <Input 
                                  value={line.urunAdi}
                                  onChange={(e) => updateInvoiceLine(line.id, 'urunAdi', e.target.value)}
                                  placeholder="Ürün/hizmet adı"
                                  className="min-w-[200px]"
                                />
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
                            setCurrentInvoice(prev => ({
                              ...prev,
                              belgeBazliIskontoYuzde: parseFloat(e.target.value) || 0
                            }));
                            setTimeout(calculateInvoice, 0);
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
                  <div ref={printRef} className="bg-white p-8 rounded-lg print-content">
                    {/* Invoice Header */}
                    <div className="text-center mb-8">
                      <h1 className="text-3xl font-bold text-primary mb-2">FATURA</h1>
                      <div className="text-lg font-medium">{currentInvoice.faturaNo}</div>
                      <div className="text-muted-foreground">Tarih: {new Date(currentInvoice.tarih).toLocaleDateString('tr-TR')}</div>
                    </div>

                    {/* Company and Customer Info */}
                    <div className="grid grid-cols-2 gap-8 mb-8">
                      <div>
                        <h3 className="font-bold text-lg mb-3 text-primary">Satıcı Bilgileri</h3>
                        <div className="space-y-1">
                          <div className="font-medium">{company.firmaAdi}</div>
                          <div>VKN: {company.vkn}</div>
                          <div>Vergi Dairesi: {company.vergiDairesi}</div>
                          <div>{company.adres}</div>
                          <div>{company.email}</div>
                          <div>{company.telefon}</div>
                        </div>
                      </div>
                      <div>
                        <h3 className="font-bold text-lg mb-3 text-primary">Alıcı Bilgileri</h3>
                        <div className="space-y-1">
                          <div className="font-medium">{currentInvoice.alici.unvanVeyaAdSoyad}</div>
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
                    <table className="w-full border-collapse border border-gray-300 mb-6">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 p-2 text-left">Ürün/Hizmet</th>
                          <th className="border border-gray-300 p-2 text-center">Adet</th>
                          <th className="border border-gray-300 p-2 text-center">Birim</th>
                          <th className="border border-gray-300 p-2 text-right">Birim Fiyat</th>
                          <th className="border border-gray-300 p-2 text-right">İskonto %</th>
                          <th className="border border-gray-300 p-2 text-right">KDV %</th>
                          <th className="border border-gray-300 p-2 text-right">Toplam</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentInvoice.satirlar.map((line) => (
                          <tr key={line.id}>
                            <td className="border border-gray-300 p-2">{line.urunAdi}</td>
                            <td className="border border-gray-300 p-2 text-center">{line.adet}</td>
                            <td className="border border-gray-300 p-2 text-center">{line.birim}</td>
                            <td className="border border-gray-300 p-2 text-right turkish-currency">
                              {formatTurkishCurrency(line.birimFiyat)}
                            </td>
                            <td className="border border-gray-300 p-2 text-right">%{line.iskontoYuzde}</td>
                            <td className="border border-gray-300 p-2 text-right">%{line.kdvOran}</td>
                            <td className="border border-gray-300 p-2 text-right turkish-currency font-medium">
                              {formatTurkishCurrency(line.toplam)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Totals */}
                    <div className="flex justify-end">
                      <div className="w-80 space-y-2">
                        <div className="flex justify-between">
                          <span>Ara Toplam:</span>
                          <span className="turkish-currency">{formatTurkishCurrency(currentInvoice.araToplam)}</span>
                        </div>
                        {currentInvoice.iskontoToplam > 0 && (
                          <div className="flex justify-between text-destructive">
                            <span>İskonto:</span>
                            <span className="turkish-currency">-{formatTurkishCurrency(currentInvoice.iskontoToplam)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>KDV Toplam:</span>
                          <span className="turkish-currency">{formatTurkishCurrency(currentInvoice.kdvToplam)}</span>
                        </div>
                        <div className="flex justify-between text-xl font-bold border-t pt-2">
                          <span>Genel Toplam:</span>
                          <span className="turkish-currency text-primary">
                            {formatTurkishCurrency(currentInvoice.genelToplam)}
                          </span>
                        </div>
                      </div>
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
          <TabsContent value="taslaklar" className="animate-slide-up">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Save className="w-5 h-5 text-primary" />
                  Taslak Faturalar
                </CardTitle>
              </CardHeader>
              <CardContent>
                {invoices.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Henüz kaydedilmiş fatura bulunmuyor.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {invoices.map((invoice) => (
                      <div key={invoice.id} className="border rounded-lg p-4 hover:shadow-business transition-smooth">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{invoice.faturaNo}</div>
                            <div className="text-sm text-muted-foreground">
                              {invoice.alici.unvanVeyaAdSoyad} - {new Date(invoice.tarih).toLocaleDateString('tr-TR')}
                            </div>
                            <div className="text-lg font-bold turkish-currency text-primary">
                              {formatTurkishCurrency(invoice.genelToplam)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={invoice.durum === 'tamamlandi' ? 'default' : 'secondary'}>
                              {invoice.durum === 'tamamlandi' ? 'Tamamlandı' : 'Taslak'}
                            </Badge>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setCurrentInvoice(invoice);
                                setActiveTab('fatura');
                              }}
                            >
                              Düzenle
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

          {/* Products Tab */}
          <TabsContent value="urunler" className="animate-slide-up">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-accent" />
                  Ürün / Hizmet Kartları
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Ürün/hizmet yönetimi geliştirilmekte...</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Customers Tab */}
          <TabsContent value="musteriler" className="animate-slide-up">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Müşteri Kartları
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Müşteri yönetimi geliştirilmekte...</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="ayarlar" className="animate-slide-up">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary" />
                  Firma Ayarları
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label>Firma Adı</Label>
                      <Input 
                        value={company.firmaAdi}
                        onChange={(e) => setCompany(prev => ({ ...prev, firmaAdi: e.target.value }))}
                        placeholder="Firma adınız"
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
                        placeholder="Vergi dairesi adı"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <Label>Fatura Seri</Label>
                      <Input 
                        value={company.seri}
                        onChange={(e) => setCompany(prev => ({ ...prev, seri: e.target.value }))}
                        placeholder="A"
                        maxLength={3}
                      />
                    </div>
                    <div>
                      <Label>Sıradaki Fatura No</Label>
                      <Input 
                        type="number"
                        value={company.sira}
                        onChange={(e) => setCompany(prev => ({ ...prev, sira: parseInt(e.target.value) || 1 }))}
                        min={1}
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
                </div>

                <div>
                  <Label>Adres</Label>
                  <Textarea 
                    value={company.adres}
                    onChange={(e) => setCompany(prev => ({ ...prev, adres: e.target.value }))}
                    placeholder="Firma adresi..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>E-posta</Label>
                    <Input 
                      type="email"
                      value={company.email}
                      onChange={(e) => setCompany(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="info@firma.com"
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
                </div>

                <div className="flex justify-end pt-4">
                  <Button 
                    variant="success"
                    onClick={() => {
                      toast({
                        title: "Başarılı",
                        description: "Firma ayarları kaydedildi.",
                      });
                    }}
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