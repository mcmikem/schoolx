"use client";

import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { cardClassName } from "@/lib/utils";
import { format } from "date-fns";

export default function StudentWalletsPage() {
  const { school } = useAuth();
  const [loading, setLoading] = useState(true);
  const [wallets, setWallets] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [showTopup, setShowTopup] = useState<any>(null);
  const [topupAmount, setTopupAmount] = useState("");

  const fetchWallets = async () => {
    if (!school?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('student_wallets')
      .select('*, students(first_name, last_name, student_number)')
      .eq('school_id', school.id);
    
    if (data) setWallets(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchWallets();
  }, [school?.id]);

  const handleTopup = async () => {
    if (!showTopup || !topupAmount) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc('topup_student_wallet', {
        p_student_id: showTopup.student_id,
        p_amount: parseFloat(topupAmount),
        p_description: 'Manual Top-up by Admin',
        p_ref: `ADM-${Date.now()}`
      });

      if (error) throw error;
      setTopupAmount("");
      setShowTopup(null);
      fetchWallets();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredWallets = wallets.filter(w => 
    `${w.students.first_name} ${w.students.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    w.students.student_number.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PageErrorBoundary>
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
           <h1 className="text-3xl font-black text-slate-800 tracking-tight">Student Wallets</h1>
           <p className="text-slate-500 font-medium tracking-tight">Manage digital pocket money and transaction logs</p>
        </div>
        <div className="flex gap-4">
           <div className="relative">
              <input 
                type="text" 
                placeholder="Search students..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-primary-100 min-w-[300px]"
              />
              <MaterialIcon icon="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-[32px] bg-primary-800 text-white shadow-xl shadow-primary-800/20 flex flex-col justify-between min-h-[160px]">
           <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Total Circulating Balance</p>
           <h2 className="text-3xl font-black">UGX {wallets.reduce((s, w) => s + w.balance, 0).toLocaleString()}</h2>
           <div className="flex items-center gap-2 text-[10px] font-bold bg-white/10 w-fit px-3 py-1 rounded-full">
              <MaterialIcon icon="trending_up" style={{ fontSize: 14 }} />
              Active across {wallets.length} students
           </div>
        </div>
        
        <div className="p-6 rounded-[32px] bg-white border border-slate-100 flex items-center gap-4">
           <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <MaterialIcon icon="receipt_long" style={{ fontSize: 28 }} />
           </div>
           <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Top-ups (MTD)</p>
              <p className="text-2xl font-black text-slate-800">UGX 4.2M</p>
           </div>
        </div>

        <div className="p-6 rounded-[32px] bg-white border border-slate-100 flex items-center gap-4">
           <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <MaterialIcon icon="credit_card_off" style={{ fontSize: 28 }} />
           </div>
           <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Low Balance Warnings</p>
              <p className="text-2xl font-black text-slate-800">12 Students</p>
           </div>
        </div>
      </div>

      <div className={cardClassName + " overflow-hidden"}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Student</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Reg No</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Balance</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Daily Limit</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Last Activity</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredWallets.map(wallet => (
                <tr key={wallet.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-800">{wallet.students.first_name} {wallet.students.last_name}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{wallet.students.student_number}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className={`text-sm font-black ${wallet.balance < 2000 ? 'text-red-500' : 'text-primary-800'}`}>
                      UGX {wallet.balance.toLocaleString()}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs font-medium text-slate-500">{wallet.daily_spend_limit ? `UGX ${wallet.daily_spend_limit.toLocaleString()}` : "No Limit"}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs text-slate-400 font-medium">
                      {wallet.updated_at ? format(new Date(wallet.updated_at), 'MMM dd, HH:mm') : 'N/A'}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => setShowTopup(wallet)}
                      className="px-4 py-2 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:scale-105 transition-all shadow-md opacity-0 group-hover:opacity-100"
                    >
                      Top Up
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showTopup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-800 flex items-center justify-center">
                   <MaterialIcon icon="add_card" style={{ fontSize: 24 }} />
                </div>
                <button onClick={() => setShowTopup(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                  <MaterialIcon icon="close" className="text-slate-400" />
                </button>
              </div>

              <div className="mb-8">
                 <h3 className="text-2xl font-black text-slate-800 mb-1">Wallet Top-up</h3>
                 <p className="text-sm text-slate-500 font-medium">Adding funds for <span className="text-slate-800 font-bold">{showTopup.students.first_name} {showTopup.students.last_name}</span></p>
              </div>

              <div className="space-y-6">
                <div>
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Amount (UGX)</label>
                   <input 
                    type="number" 
                    value={topupAmount}
                    onChange={(e) => setTopupAmount(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-xl font-black outline-none focus:ring-4 focus:ring-primary-100 transition-all"
                   />
                </div>
                
                <div className="flex gap-2">
                   {[5000, 10000, 20000, 50000].map(amt => (
                     <button 
                      key={amt}
                      onClick={() => setTopupAmount(amt.toString())}
                      className="flex-1 py-2 rounded-xl border border-slate-100 text-[10px] font-bold text-slate-500 hover:border-primary-200 hover:text-primary-800 transition-all"
                     >
                        +{amt/1000}k
                     </button>
                   ))}
                </div>

                <div className="p-4 bg-blue-50 rounded-2xl flex items-start gap-3">
                   <MaterialIcon icon="info" className="text-blue-500 shrink-0" style={{ fontSize: 18 }} />
                   <p className="text-[11px] text-blue-700 leading-relaxed font-medium">
                     This balance will be available immediately for canteen and store purchases using the student's ID card.
                   </p>
                </div>

                <button 
                  onClick={handleTopup}
                  disabled={!topupAmount || loading}
                  className="w-full py-5 bg-primary-800 text-white rounded-[28px] font-black uppercase tracking-[2px] shadow-xl shadow-primary-800/20 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-3"
                >
                   {loading ? (
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                   ) : (
                      <>
                        <MaterialIcon icon="bolt" />
                        Confirm Top-up
                      </>
                   )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </PageErrorBoundary>
  );
}
