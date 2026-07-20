import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  TrendingUp, ShoppingBag, Package, Wallet, ChevronDown, Search,
  Clock, CheckCircle, XCircle, Layers,
} from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../theme';
import { api } from '../../../services/api';
import { LoadingState, ErrorState } from '../../../components/States';

interface ApiOrderLine {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
}

interface ApiOrder {
  orderId: string;
  items: ApiOrderLine[];
  totalAmount: string;
  status: string;
  createdAt: string;
}

interface ApiProduct {
  productId: string;
  name: string;
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: '#e67e22', CONFIRMED: '#2980b9', SHIPPED: '#8e44ad',
  DELIVERED: '#27ae60', CANCELLED: '#e74c3c',
};

const RANGE_OPTIONS: { label: string; days: number | null }[] = [
  { label: '7D',  days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: 'All', days: null },
];

export const SalesReportScreen = () => {
  const [orders,     setOrders]     = useState<ApiOrder[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [rangeDays,  setRangeDays]  = useState<number | null>(30);

  const [products,        setProducts]        = useState<ApiProduct[]>([]);
  const [productsLoading,  setProductsLoading]  = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ApiProduct | null>(null); // null = All Products
  const [pickerVisible,   setPickerVisible]   = useState(false);
  const [searchQuery,     setSearchQuery]     = useState('');

  const fetchAllOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let all: ApiOrder[] = [];
      let cursor: string | undefined;
      do {
        const path: string = cursor ? `/orders?cursor=${cursor}` : '/orders';
        const res: { items: ApiOrder[]; nextCursor?: string } = await api.get(path);
        all = all.concat(res.items);
        cursor = res.nextCursor;
      } while (cursor);
      setOrders(all);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load sales data');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchAllOrders(); }, [fetchAllOrders]));

  // Products list is loaded once and cached for the lifetime of this screen —
  // switching the product filter never re-fetches, it just re-scopes data
  // already in memory.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setProductsLoading(true);
      try {
        let all: ApiProduct[] = [];
        let cursor: string | undefined;
        do {
          const path: string = cursor ? `/products?cursor=${cursor}` : '/products';
          const res: { items: ApiProduct[]; nextCursor?: string } = await api.get(path);
          all = all.concat(res.items);
          cursor = res.nextCursor;
        } while (cursor);
        if (!cancelled) setProducts(all);
      } catch {
        // Product filter is a non-critical enhancement — a failed fetch just
        // leaves the dropdown showing "All Products" only.
      } finally {
        if (!cancelled) setProductsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredOrders = useMemo(() => {
    if (rangeDays === null) return orders;
    const cutoff = Date.now() - rangeDays * 24 * 60 * 60 * 1000;
    return orders.filter(o => new Date(o.createdAt).getTime() >= cutoff);
  }, [orders, rangeDays]);

  const productScopedOrders = useMemo(() => {
    if (!selectedProduct) return filteredOrders;
    return filteredOrders.filter(o => (o.items ?? []).some(li => li.productId === selectedProduct.productId));
  }, [filteredOrders, selectedProduct]);

  const {
    totalRevenue, orderCount, avgOrderValue, statusBreakdown, topProducts,
    totalQuantity, pendingCount, deliveredCount, cancelledCount,
  } = useMemo(() => {
    const billable = productScopedOrders.filter(o => o.status !== 'CANCELLED');

    let revenue = 0;
    let quantity = 0;
    const productAgg: Record<string, { name: string; quantity: number; revenue: number }> = {};

    for (const o of billable) {
      const lines = selectedProduct
        ? (o.items ?? []).filter(li => li.productId === selectedProduct.productId)
        : (o.items ?? []);
      for (const line of lines) {
        revenue += Number(line.subtotal || 0);
        quantity += Number(line.quantity || 0);
        const key = line.productId || line.productName;
        if (!productAgg[key]) productAgg[key] = { name: line.productName, quantity: 0, revenue: 0 };
        productAgg[key].quantity += Number(line.quantity || 0);
        productAgg[key].revenue += Number(line.subtotal || 0);
      }
    }

    const statusCounts: Record<string, number> = {};
    for (const o of productScopedOrders) {
      statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;
    }

    const top = Object.values(productAgg).sort((a, b) => b.revenue - a.revenue).slice(0, 8);

    return {
      totalRevenue: revenue,
      orderCount: productScopedOrders.length,
      avgOrderValue: billable.length > 0 ? revenue / billable.length : 0,
      statusBreakdown: Object.entries(statusCounts).sort((a, b) => b[1] - a[1]),
      topProducts: top,
      totalQuantity: quantity,
      pendingCount: statusCounts['PENDING'] ?? 0,
      deliveredCount: statusCounts['DELIVERED'] ?? 0,
      cancelledCount: statusCounts['CANCELLED'] ?? 0,
    };
  }, [productScopedOrders, selectedProduct]);

  const filteredProductOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p => p.name.toLowerCase().includes(q));
  }, [products, searchQuery]);

  const openPicker = () => setPickerVisible(true);
  const closePicker = () => { setPickerVisible(false); setSearchQuery(''); };
  const pickProduct = (p: ApiProduct | null) => { setSelectedProduct(p); closePicker(); };

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState error={error} />;

  const emptyMessage = selectedProduct
    ? 'No sales found for the selected product.'
    : 'No orders in this period';

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Date range filter */}
        <View style={styles.rangeRow}>
          {RANGE_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.label}
              style={[styles.rangeBtn, rangeDays === opt.days && styles.rangeBtnActive]}
              onPress={() => setRangeDays(opt.days)}
            >
              <Text style={[styles.rangeBtnText, rangeDays === opt.days && styles.rangeBtnTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Product filter */}
        <View style={styles.productField}>
          <Text style={styles.productLabel}>Product</Text>
          <TouchableOpacity style={styles.productSelect} onPress={openPicker} activeOpacity={0.7}>
            <Text style={styles.productSelectText} numberOfLines={1}>
              {selectedProduct ? selectedProduct.name : 'All Products'}
            </Text>
            <ChevronDown size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Summary cards */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <View style={[styles.summaryIcon, { backgroundColor: '#E8F5E9' }]}>
              <Wallet size={18} color="#2E7D32" />
            </View>
            <Text style={styles.summaryValue}>₹{totalRevenue.toLocaleString('en-IN')}</Text>
            <Text style={styles.summaryLabel}>Revenue</Text>
          </View>
          <View style={styles.summaryCard}>
            <View style={[styles.summaryIcon, { backgroundColor: '#E3F2FD' }]}>
              <ShoppingBag size={18} color="#1565C0" />
            </View>
            <Text style={styles.summaryValue}>{orderCount}</Text>
            <Text style={styles.summaryLabel}>Orders</Text>
          </View>
          <View style={styles.summaryCard}>
            <View style={[styles.summaryIcon, { backgroundColor: '#FFF3E0' }]}>
              <TrendingUp size={18} color="#E65100" />
            </View>
            <Text style={styles.summaryValue}>₹{avgOrderValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
            <Text style={styles.summaryLabel}>Avg Order</Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <View style={[styles.summaryIcon, { backgroundColor: '#EDE7F6' }]}>
              <Layers size={18} color="#5E35B1" />
            </View>
            <Text style={styles.summaryValue}>{totalQuantity}</Text>
            <Text style={styles.summaryLabel}>Qty Sold</Text>
          </View>
          <View style={styles.summaryCard}>
            <View style={[styles.summaryIcon, { backgroundColor: '#FFF3E0' }]}>
              <Clock size={18} color="#e67e22" />
            </View>
            <Text style={styles.summaryValue}>{pendingCount}</Text>
            <Text style={styles.summaryLabel}>Pending</Text>
          </View>
          <View style={styles.summaryCard}>
            <View style={[styles.summaryIcon, { backgroundColor: '#E8F5E9' }]}>
              <CheckCircle size={18} color="#27ae60" />
            </View>
            <Text style={styles.summaryValue}>{deliveredCount}</Text>
            <Text style={styles.summaryLabel}>Delivered</Text>
          </View>
          <View style={styles.summaryCard}>
            <View style={[styles.summaryIcon, { backgroundColor: '#FFEBEE' }]}>
              <XCircle size={18} color="#e74c3c" />
            </View>
            <Text style={styles.summaryValue}>{cancelledCount}</Text>
            <Text style={styles.summaryLabel}>Cancelled</Text>
          </View>
        </View>

        {orderCount === 0 ? (
          <View style={styles.emptyBox}>
            <Package size={40} color="#DDD" />
            <Text style={styles.emptyText}>{emptyMessage}</Text>
          </View>
        ) : (
          <>
            {/* Status breakdown */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>ORDERS BY STATUS</Text>
              {statusBreakdown.map(([status, count]) => {
                const pct = orderCount > 0 ? (count / orderCount) * 100 : 0;
                const color = STATUS_COLOR[status] ?? '#666';
                return (
                  <View key={status} style={styles.statusRow}>
                    <View style={styles.statusTop}>
                      <Text style={styles.statusLabel}>{status}</Text>
                      <Text style={styles.statusCount}>{count} order{count === 1 ? '' : 's'}</Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Top products */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>TOP PRODUCTS</Text>
              {topProducts.length === 0 ? (
                <Text style={styles.noDataText}>No product sales in this period</Text>
              ) : topProducts.map((p, i) => (
                <View key={i} style={styles.productRow}>
                  <View style={styles.productRank}>
                    <Text style={styles.productRankText}>{i + 1}</Text>
                  </View>
                  <View style={styles.productInfo}>
                    <Text style={styles.productName}>{p.name}</Text>
                    <Text style={styles.productQty}>{p.quantity} sold</Text>
                  </View>
                  <Text style={styles.productRevenue}>₹{p.revenue.toLocaleString('en-IN')}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* Product picker */}
      <Modal visible={pickerVisible} transparent animationType="slide" onRequestClose={closePicker}>
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={closePicker}>
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Filter by Product</Text>

            <View style={styles.searchBox}>
              <Search size={16} color={COLORS.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search Product..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
              />
            </View>

            <FlatList
              data={filteredProductOptions}
              keyExtractor={p => p.productId}
              style={styles.optionList}
              ListHeaderComponent={!searchQuery ? (
                <TouchableOpacity style={styles.optionRow} onPress={() => pickProduct(null)}>
                  <Text style={[styles.optionText, !selectedProduct && styles.optionTextActive]}>All Products</Text>
                </TouchableOpacity>
              ) : null}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.optionRow} onPress={() => pickProduct(item)}>
                  <Text style={[styles.optionText, selectedProduct?.productId === item.productId && styles.optionTextActive]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.noDataText}>
                  {productsLoading ? 'Loading products...' : 'No products match your search'}
                </Text>
              }
              keyboardShouldPersistTaps="handled"
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: COLORS.background },
  container: { padding: SPACING.md, paddingBottom: SPACING.xl },
  rangeRow:  { flexDirection: 'row', gap: 8, marginBottom: SPACING.md },
  rangeBtn:  { flex: 1, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, alignItems: 'center' },
  rangeBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  rangeBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  rangeBtnTextActive: { color: '#fff' },
  productField: { marginBottom: SPACING.md },
  productLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  productSelect: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 12,
  },
  productSelectText: { fontSize: 14, fontWeight: '600', color: COLORS.text, flex: 1, marginRight: 8 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: SPACING.md },
  summaryCard: { flex: 1, backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2 },
  summaryIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  summaryValue: { fontSize: 16, fontWeight: 'bold', color: COLORS.text, textAlign: 'center' },
  summaryLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  emptyBox: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 14, color: COLORS.textSecondary, marginTop: 10, textAlign: 'center' },
  section: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', color: COLORS.textSecondary, letterSpacing: 1, marginBottom: SPACING.md },
  statusRow: { marginBottom: SPACING.sm },
  statusTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  statusLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  statusCount: { fontSize: 12, color: COLORS.textSecondary },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: '#F0F0F0', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  noDataText: { fontSize: 13, color: COLORS.textSecondary, fontStyle: 'italic', paddingVertical: SPACING.md, textAlign: 'center' },
  productRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  productRank: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#F0F2F5', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  productRankText: { fontSize: 11, fontWeight: 'bold', color: COLORS.textSecondary },
  productInfo: { flex: 1 },
  productName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  productQty: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  productRevenue: { fontSize: 14, fontWeight: 'bold', color: COLORS.primary },
  // Product picker sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheetContainer: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, maxHeight: '75%',
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DDD', alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginBottom: 14, textAlign: 'center' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F5F5F5', borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 12, marginBottom: 8,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: COLORS.text },
  optionList: { flexGrow: 0 },
  optionRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  optionText: { fontSize: 15, color: COLORS.text },
  optionTextActive: { color: COLORS.primary, fontWeight: '700' },
});
