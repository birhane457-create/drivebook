import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/shared/PageHeader';
import ProductFamilyManager from '@/components/mdm/ProductFamilyManager';
import ProductVariantManager from '@/components/mdm/ProductVariantManager';
import VendorCatalogManager from '@/components/mdm/VendorCatalogManager';

export default function MasterData() {
  return (
    <div className="p-6">
      <PageHeader title="Master Data Management" subtitle="Single source of truth — product families, variants, vendor catalogs & data quality" />
      <Tabs defaultValue="families">
        <TabsList className="mb-6">
          <TabsTrigger value="families">Product Families</TabsTrigger>
          <TabsTrigger value="variants">Variants</TabsTrigger>
          <TabsTrigger value="vendor">Vendor Catalog</TabsTrigger>
        </TabsList>
        <TabsContent value="families"><ProductFamilyManager /></TabsContent>
        <TabsContent value="variants"><ProductVariantManager /></TabsContent>
        <TabsContent value="vendor"><VendorCatalogManager /></TabsContent>
      </Tabs>
    </div>
  );
}