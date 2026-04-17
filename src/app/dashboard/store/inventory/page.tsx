"use client";

import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { cardClassName } from "@/lib/utils";

export default function InventoryPage() {
  const { school } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', price: '', category: 'Snacks', stock_quantity: '' });

  const fetchInventory = async () => {
    if (!school?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('canteen_items')
      .select('*')
      .eq('school_id', school.id)
      .order('name');
    
    if (data) setItems(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchInventory();
  }, [school?.id]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school?.id) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from('canteen_items')
        .insert({
          school_id: school.id,
          name: newItem.name,
          price: parseFloat(newItem.price),
          category: newItem.category,
          stock_quantity: parseInt(newItem.stock_quantity) || 0
        });

      if (error) throw error;
      setNewItem({ name: '', price: '', category: 'Snacks', stock_quantity: '' });
      setShowAdd(false);
      fetchInventory();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageErrorBoundary>
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
           <h1 className="text-3xl font-black text-slate-800 tracking-tight">Stock & Inventory</h1>
           <p className="text-slate-500 font-medium tracking-tight">Manage canteen products and stock levels</p>
        </div>
        <button 
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-6 py-3 bg-[var(--primary)] text-white rounded-2xl font-bold shadow-lg hover:scale-105 transition-all"
        >
          <MaterialIcon icon="add" />
          Add Item
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         {[
           { label: 'Total Items', value: items.length, icon: 'inventory_2', color: 'bg-blue-500' },
           { label: 'Out of Stock', value: items.filter(i => i.stock_quantity <= 0).length, icon: 'warning', color: 'bg-red-500' },
           { label: 'Total Value', value: `UGX ${items.reduce((s, i) => s + (i.price * i.stock_quantity), 0).toLocaleString()}`, icon: 'payments', color: 'bg-emerald-500' },
           { label: 'Categories', value: new Set(items.map(i => i.category)).size, icon: 'category', color: 'bg-amber-500' }
         ].map(stat => (
           <div key={stat.label} className="p-4 bg-white rounded-3xl border border-slate-100 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl ${stat.color} text-white flex items-center justify-center`}>
                <MaterialIcon icon={stat.icon} />
              </div>
              <div>
                 <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{stat.label}</p>
                 <p className="text-xl font-black text-slate-800">{stat.value}</p>
              </div>
           </div>
         ))}
      </div>

      <div className={cardClassName + " overflow-hidden"}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
               <tr className="bg-slate-50/50">
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Item Name</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Category</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Price</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Current Stock</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-right">Actions</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
               {items.map(item => (
                 <tr key={item.id} className="hover:bg-slate-50/50 group transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800">{item.name}</td>
                    <td className="px-6 py-4">
                       <span className="px-3 py-1 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                          {item.category}
                       </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-primary-800">UGX {item.price.toLocaleString()}</td>
                    <td className="px-6 py-4 font-black">
                       <span className={item.stock_quantity <= item.min_stock_level ? 'text-red-500 animate-pulse' : 'text-slate-800'}>
                         {item.stock_quantity}
                       </span>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${item.stock_quantity > 0 ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          <span className="text-xs font-bold text-slate-500">{item.stock_quantity > 0 ? 'In Stock' : 'Out of Stock'}</span>
                       </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <button className="p-2 text-slate-300 hover:text-primary-800 transition-colors opacity-0 group-hover:opacity-100">
                          <MaterialIcon icon="edit" style={{ fontSize: 20 }} />
                       </button>
                    </td>
                 </tr>
               ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl overflow-hidden">
             <form onSubmit={handleAddItem} className="p-8">
                <div className="flex justify-between items-center mb-8">
                   <h2 className="text-2xl font-black text-slate-800">Add New Product</h2>
                   <button type="button" onClick={() => setShowAdd(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                      <MaterialIcon icon="close" className="text-slate-400" />
                   </button>
                </div>

                <div className="space-y-6">
                   <div className="grid grid-cols-2 gap-6">
                      <div className="col-span-2">
                         <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Product Name</label>
                         <input 
                            required 
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary-100 transition-all font-bold"
                            value={newItem.name}
                            onChange={e => setNewItem({...newItem, name: e.target.value})}
                         />
                      </div>
                      <div>
                         <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Category</label>
                         <select 
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary-100 transition-all font-bold appearance-none bg-no-repeat"
                            value={newItem.category}
                            onChange={e => setNewItem({...newItem, category: e.target.value})}
                         >
                            <option>Snacks</option>
                            <option>Drinks</option>
                            <option>Stationery</option>
                            <option>Uniforms</option>
                            <option>Toiletries</option>
                         </select>
                      </div>
                      <div>
                         <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Unit Price (UGX)</label>
                         <input 
                            required 
                            type="number"
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary-100 transition-all font-bold"
                            value={newItem.price}
                            onChange={e => setNewItem({...newItem, price: e.target.value})}
                         />
                      </div>
                      <div className="col-span-2">
                         <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Initial Stock Quantity</label>
                         <input 
                            required 
                            type="number"
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary-100 transition-all font-bold"
                            value={newItem.stock_quantity}
                            onChange={e => setNewItem({...newItem, stock_quantity: e.target.value})}
                         />
                      </div>
                   </div>

                   <button 
                     type="submit" 
                     className="w-full py-5 bg-primary-800 text-white rounded-[28px] font-black uppercase tracking-widest shadow-xl shadow-primary-800/20 hover:scale-[1.02] transition-all"
                   >
                     Save Product
                   </button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
    </PageErrorBoundary>
  );
}
