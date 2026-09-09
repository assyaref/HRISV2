import { useEffect, useMemo, useState, useCallback } from 'react';
import { Download, FileText, Loader2, Lock, Pencil, Play, Send, Upload } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as api from '../services/api';
import type { CompanySetting, Employee, Payroll } from '../types';
import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input, Select } from '../components/ui/Input';
import { DataTable, type Column } from '../components/ui/DataTable';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, exportToExcel } from '../lib/utils';
import { db } from '../lib/db';
import { buildSlipPassword, slipFileName, slipStatusLabel } from '../lib/payslip';
import { downloadPdfBytes, encryptPdfBytes, fileToDataUrl, isPdfFile, toArrayBufferCopy } from '../lib/pdfEncrypt';

/** Bangun bytes PDF slip gaji (plaintext, belum dienkripsi) memakai jsPDF. */
function buildSlipPdfBytes(p: Payroll, emp: Employee | undefined, settings: CompanySetting): Uint8Array {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text(settings.companyName || 'HRIS Lite Enterprise', 14, 20);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(settings.companyAddress || '', 14, 27);
  doc.setTextColor(0);
  doc.setFontSize(14);
  doc.text('SLIP GAJI', 14, 40);
  doc.setFontSize(10);
  doc.text(`Periode: ${p.period}`, 14, 48);
  doc.text(`Nama: ${emp?.fullName || '-'}`, 14, 55);
  doc.text(`NIP: ${emp?.employeeId || p.employeeId}`, 14, 62);
  doc.text(`NIK: ${emp?.nik || '-'}`, 14, 69);

  autoTable(doc, {
    startY: 78,
    head: [['Komponen', 'Jumlah']],
    body: [
      ['Gaji Pokok', formatCurrency(p.basicSalary)],
      ['Tunjangan', formatCurrency(p.allowance)],
      ['Lembur', formatCurrency(p.overtime)],
      ['Potongan', `-${formatCurrency(p.deduction)}`],
      ['BPJS', `-${formatCurrency(p.bpjs)}`],
      ['PPh21', `-${formatCurrency(p.pph21)}`],
      ['Gaji Bersih', formatCurrency(p.netSalary)],
    ],
    styles: { fontSize: 10 },
    headStyles: { fillColor: [13, 71, 161] },
  });

  doc.setFontSize(9);
  doc.setTextColor(120);
  const table = doc as unknown as { lastAutoTable?: { finalY: number } };
  const finalY = table.lastAutoTable?.finalY || 150;
  doc.text('Dokumen dienkripsi otomatis oleh HRIS Lite Enterprise', 14, finalY + 15);
  doc.text('Password slip = NIK + Tanggal Lahir (DDMMYYYY)', 14, finalY + 22);

  const output = doc.output('arraybuffer');
  return new Uint8Array(output);
}

export function PayrollPage() {
  const toast = useToast();
  const { session, isHR } = useAuth();
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [employeePool, setEmployeePool] = useState<Employee[]>(() => db.getEmployees());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [period, setPeriod] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<Payroll | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedPayroll, setSelectedPayroll] = useState<Payroll | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  /* Indeks karyawan gabungan (backend GAS + fallback lokal) agar lookup
     nama/NIK/tanggal lahir tetap akurat saat mode online. */
  const empIndex = useMemo(() => {
    const map = new Map<string, Employee>();
    [...employeePool, ...db.getEmployees()].forEach((e) => {
      if (e.id) map.set(e.id, e);
      if (e.employeeId) map.set(e.employeeId, e);
    });
    return map;
  }, [employeePool]);

  const findEmp = useCallback(
    (id: string | undefined): Employee | undefined => (id ? empIndex.get(id) : undefined),
    [empIndex]
  );

  /** Resolve karyawan utk baris payroll: dari pool master, fallback ke data
   *  bawaan payroll (employeeName/Code/NIK/DOB/Email dari backend). */
  const empOf = useCallback(
    (p: Payroll): Employee | undefined => {
      const found = findEmp(p.employeeId);
      if (found) return found;
      if (!p.employeeName) return undefined;
      return {
        id: p.employeeId,
        employeeId: p.employeeCode || p.employeeId,
        nik: p.employeeNik || '',
        fullName: p.employeeName,
        gender: 'Male',
        birthDate: p.employeeBirthDate || '',
        religion: '',
        address: '',
        phone: '',
        email: p.employeeEmail || '',
        departmentId: '',
        divisionId: '',
        positionId: '',
        joinDate: '',
        employmentStatus: 'Active',
        salary: 0,
        createdAt: '',
        updatedAt: '',
      };
    },
    [findEmp]
  );

  const load = useCallback(async () => {
    setLoading(true);
    const filters: { period?: string; employeeId?: string } = { period };
    if (!isHR && session?.employeeId) filters.employeeId = session.employeeId;
    const res = await api.getPayrolls(filters);
    if (res.success && res.data) setPayrolls(res.data);
    setLoading(false);
  }, [period, session, isHR]);

  useEffect(() => {
    load();
  }, [load]);

  // Muat master karyawan dari GAS supaya nama/NIK & DOB tersedia utk password.
  useEffect(() => {
    let alive = true;
    api
      .getEmployees({})
      .then((res) => {
        if (alive && res.success && Array.isArray(res.data) && res.data.length) {
          setEmployeePool(res.data);
        }
      })
      .catch(() => {
        /* fallback db lokal sudah tersedia */
      });
    return () => {
      alive = false;
    };
  }, []);

  /* ---------------------------------------------------------- aksi umum -- */
  const handleGenerate = async () => {
    setGenerating(true);
    const res = await api.generatePayroll(period);
    setGenerating(false);
    if (res.success) {
      toast.success(res.message);
      load();
    } else toast.error(res.message);
  };

  const handleExportExcel = () => {
    exportToExcel(
      payrolls.map((p) => ({
        Periode: p.period,
        Karyawan: empOf(p)?.fullName,
        NIP: empOf(p)?.employeeId,
        'Gaji Pokok': p.basicSalary,
        Tunjangan: p.allowance,
        Lembur: p.overtime,
        Potongan: p.deduction,
        BPJS: p.bpjs,
        PPh21: p.pph21,
        'Gaji Bersih': p.netSalary,
        Status: slipStatusLabel(p),
      })),
      `payroll-${period}`
    );
    toast.success('Payroll diexport');
  };
  /* ---------------------------------------------------- slip & enkripsi -- */
  /** Unduh slip dari Google Drive (file upload yg sudah terenkripsi). */
  const openStoredSlip = (p: Payroll) => {
    if (p.slipUrl) window.open(p.slipUrl, '_blank', 'noopener,noreferrer');
  };

  /** Generate slip PDF lalu ENKRIPSI sungguhan di browser sebelum diunduh. */
  const handleSlip = async (p: Payroll) => {
    const emp = empOf(p);
    const password = buildSlipPassword(emp);
    if (!password) {
      toast.error('Data NIK & tanggal lahir karyawan wajib diisi untuk membuat password slip.');
      return;
    }
    try {
      const plain = buildSlipPdfBytes(p, emp, db.getSettings());
      const encrypted = await encryptPdfBytes(plain, password);
      downloadPdfBytes(encrypted, slipFileName(emp?.nik || emp?.employeeId || p.employeeId, p.period));
      toast.success(`Slip terenkripsi dibuat. Password: ${password}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal membuat slip PDF terenkripsi');
    }
  };

  /** Buka modal upload (slip dienkripsi otomatis sebelum dikirim ke Drive). */
  const handleUploadSlip = (p: Payroll) => {
    setSelectedPayroll(p);
    setPdfFile(null);
    setUploadOpen(true);
  };

  const handleUploadSubmit = async () => {
    if (!pdfFile || !selectedPayroll) {
      toast.error('Pilih file PDF terlebih dahulu');
      return;
    }
    if (!isPdfFile(pdfFile)) {
      toast.error('File harus berformat .pdf');
      return;
    }

    const emp = empOf(selectedPayroll);
    const password = buildSlipPassword(emp);
    if (!password) {
      toast.error('Data NIK & tanggal lahir karyawan wajib diisi untuk mengenkripsi slip.');
      return;
    }

    setUploading(true);
    try {
      const raw = await pdfFile.arrayBuffer();
      const encrypted = await encryptPdfBytes(raw, password);
      const name = pdfFile.name.replace(/\.pdf$/i, '') + '-terenkripsi.pdf';
      const encryptedFile = new File([toArrayBufferCopy(encrypted)], name, { type: 'application/pdf' });
      const dataUrl = await fileToDataUrl(encryptedFile);

      const res = await api.uploadPayslip(
        dataUrl,
        name,
        selectedPayroll.employeeId,
        selectedPayroll.period,
        selectedPayroll.id
      );

      if (res.success) {
        toast.success(`Slip dienkripsi (password: ${password}) lalu disimpan ke Google Drive.`);
        setUploadOpen(false);
        setPdfFile(null);
        setSelectedPayroll(null);
        load();
      } else {
        toast.error(res.message || 'Gagal upload slip gaji');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal enkripsi/upload slip gaji');
    } finally {
      setUploading(false);
    }
  };

  /** Kirim slip gaji ke karyawan (simulasi) — butuh slip sudah tersedia. */
  const handleSend = async (p: Payroll) => {
    if (slipStatusLabel(p) === 'Draft') {
      toast.error('Upload slip gaji terlebih dahulu!');
      return;
    }
    setSendingId(p.id);
    try {
      const res = await api.sendPayslip(p.id);
      if (res.success) {
        const emp = empOf(p);
        const password = buildSlipPassword(emp);
        const email = emp?.email ? ` ke ${emp.email}` : '';
        toast.success(
          `Slip gaji untuk ${emp?.fullName || p.employeeId} berhasil dikirim${email}. Password: ${password || '-'}`
        );
        load();
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengirim slip');
    } finally {
      setSendingId(null);
    }
  };

  /* ------------------------------------------------------------- edit --- */
  const openEdit = (p: Payroll) => {
    setEditForm({ ...p });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editForm) return;
    setSaving(true);
    const res = await api.updatePayroll(editForm.id, editForm);
    setSaving(false);
    if (res.success) {
      toast.success(res.message);
      setEditOpen(false);
      load();
    } else toast.error(res.message);
  };

  /* ----------------------------------------------------------- kolom ----- */
  const columns: Column<Payroll & Record<string, unknown>>[] = [
    {
      key: 'employeeId',
      label: 'Karyawan',
      render: (row) => {
        const emp = empOf(row);
        return (
          <div>
            <p className="font-medium">{emp?.fullName || row.employeeId}</p>
            <p className="text-xs text-slate-400">{emp?.employeeId || '-'}</p>
          </div>
        );
      },
    },
    { key: 'period', label: 'Periode', sortable: true },
    {
      key: 'basicSalary',
      label: 'Gaji Pokok',
      className: 'hidden md:table-cell',
      render: (row) => formatCurrency(row.basicSalary),
    },
    {
      key: 'allowance',
      label: 'Tunjangan',
      className: 'hidden lg:table-cell',
      render: (row) => formatCurrency(row.allowance),
    },
    {
      key: 'netSalary',
      label: 'Gaji Bersih',
      sortable: true,
      render: (row) => <span className="font-semibold text-primary">{formatCurrency(row.netSalary)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => {
        const label = slipStatusLabel(row);
        return <Badge status={label}>{label}</Badge>;
      },
    },
  ];

  const periodOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    return { value: val, label };
  });

  const selectedEmp = selectedPayroll ? empOf(selectedPayroll) : undefined;
  const selectedPassword = selectedPayroll ? buildSlipPassword(selectedEmp) : '';

  return (
    <div className="space-y-4 animate-fade-in">
      <Card>
        <CardBody className="pt-5">
          <div className="flex flex-col sm:flex-row gap-3 mb-2 items-end flex-wrap">
            <div className="sm:w-56">
              <Select
                label="Periode"
                options={periodOptions}
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              />
            </div>
            {isHR && (
              <Button onClick={handleGenerate} loading={generating}>
                <Play className="h-4 w-4" /> Generate Payroll
              </Button>
            )}
          </div>

          {isHR && (
            <div className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3">
              <Lock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Setiap slip PDF yang diupload otomatis <b>dienkripsi</b> dengan password{' '}
                <code className="font-mono bg-amber-100 dark:bg-amber-900 px-1.5 py-0.5 rounded">
                  {'{NIK}{DD}{MM}{YYYY}'}
                </code>{' '}
                dari tanggal lahir karyawan. File baru tersimpan di Google Drive setelah
                terenkripsi — hanya karyawan bersangkutan yang bisa membukanya.
              </p>
            </div>
          )}

          <DataTable
            columns={columns as Column<Record<string, unknown>>[]}
            data={payrolls as unknown as Record<string, unknown>[]}
            searchKeys={['employeeId', 'period', 'status']}
            searchPlaceholder="Cari payroll..."
            loading={loading}
            emptyMessage="Tidak ada data"
            toolbar={
              <Button size="sm" variant="outline" onClick={handleExportExcel}>
                <Download className="h-4 w-4" /> Export Excel
              </Button>
            }
            actions={(row) => {
              const p = row as unknown as Payroll;
              const sent = sendingId === p.id;
              const canSend = slipStatusLabel(p) !== 'Draft';
              return (
                <>
                  <button
                    onClick={() => handleSlip(p)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                    title="Generate & unduh slip PDF terenkripsi"
                  >
                    <FileText className="h-4 w-4" />
                  </button>
                  {p.slipUrl && (
                    <button
                      onClick={() => openStoredSlip(p)}
                      className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600"
                      title="Unduh slip terenkripsi dari Google Drive"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  )}
                  {isHR && (
                    <>
                      <button
                        onClick={() => handleUploadSlip(p)}
                        className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600"
                        title="Upload slip PDF (dienkripsi otomatis)"
                      >
                        <Upload className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleSend(p)}
                        disabled={!canSend || sent}
                        className="p-1.5 rounded-lg hover:bg-sky-50 text-sky-600 disabled:opacity-40 disabled:cursor-not-allowed"
                        title={canSend ? 'Kirim slip ke email karyawan (simulasi)' : 'Upload slip terlebih dahulu'}
                      >
                        {sent ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => openEdit(p)}
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-primary"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </>
              );
            }}
          />
        </CardBody>
      </Card>


      {/* Modal Edit Payroll */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Payroll"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Batal</Button>
            <Button onClick={handleSaveEdit} loading={saving}>Simpan</Button>
          </>
        }
      >
        {editForm && (
          <div className="space-y-4">
            <Input label="Gaji Pokok" type="number" value={editForm.basicSalary} onChange={(e) => setEditForm({ ...editForm, basicSalary: Number(e.target.value) })} />
            <Input label="Tunjangan" type="number" value={editForm.allowance} onChange={(e) => setEditForm({ ...editForm, allowance: Number(e.target.value) })} />
            <Input label="Lembur" type="number" value={editForm.overtime} onChange={(e) => setEditForm({ ...editForm, overtime: Number(e.target.value) })} />
            <Input label="Potongan" type="number" value={editForm.deduction} onChange={(e) => setEditForm({ ...editForm, deduction: Number(e.target.value) })} />
            <Input label="BPJS" type="number" value={editForm.bpjs} onChange={(e) => setEditForm({ ...editForm, bpjs: Number(e.target.value) })} />
            <Input label="PPh21" type="number" value={editForm.pph21} onChange={(e) => setEditForm({ ...editForm, pph21: Number(e.target.value) })} />
            <Select
              label="Status"
              options={[
                { value: 'Draft', label: 'Draft' },
                { value: 'Slip Tersedia', label: 'Slip Tersedia' },
                { value: 'Terkirim', label: 'Terkirim' },
              ]}
              value={editForm.status}
              onChange={(e) => setEditForm({ ...editForm, status: e.target.value as Payroll['status'] })}
            />
            <div className="p-3 rounded-xl bg-primary/5 text-sm">
              <span className="text-slate-500">Estimasi Gaji Bersih: </span>
              <span className="font-bold text-primary">
                {formatCurrency(
                  editForm.basicSalary + editForm.allowance + editForm.overtime - editForm.deduction - editForm.bpjs - editForm.pph21
                )}
              </span>
            </div>
          </div>
        )}
      </Modal>


      {/* Modal Upload Slip PDF — file dienkripsi di browser sebelum ke Drive */}
      <Modal
        open={uploadOpen}
        onClose={() => { setUploadOpen(false); setSelectedPayroll(null); setPdfFile(null); }}
        title="Upload Slip Gaji PDF (auto-encrypt)"
        footer={
          <>
            <Button variant="outline" onClick={() => { setUploadOpen(false); setSelectedPayroll(null); setPdfFile(null); }}>Batal</Button>
            <Button onClick={handleUploadSubmit} loading={uploading} disabled={!pdfFile}>
              <Upload className="h-4 w-4" /> Upload & Enkripsi
            </Button>
          </>
        }
      >
        {selectedPayroll && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {selectedEmp?.fullName || selectedPayroll.employeeId} — {selectedPayroll.period}
              </p>
              {selectedEmp && (
                <p className="text-xs text-slate-500 mt-1">
                  NIK: {selectedEmp.nik || '-'} • Tanggal lahir: {selectedEmp.birthDate || '-'}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Pilih File PDF Slip Gaji
              </label>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-dark"
              />
              {pdfFile && (
                <p className="text-xs text-slate-500">
                  File: {pdfFile.name} ({(pdfFile.size / 1024).toFixed(1)} KB)
                  {!isPdfFile(pdfFile) && <span className="text-danger"> — bukan PDF!</span>}
                </p>
              )}
            </div>


            <div
              className={`p-4 rounded-xl border ${
                selectedPassword
                  ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
                  : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
              }`}
            >
              <div className="flex items-start gap-2">
                <Lock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className={`text-sm ${selectedPassword ? 'text-amber-800 dark:text-amber-300' : 'text-red-700 dark:text-red-300'}`}>
                  <p className="font-medium mb-1">Enkripsi Otomatis</p>
                  {selectedPassword ? (
                    <>
                      <p className="text-xs">
                        Password: <code className="bg-amber-100 dark:bg-amber-900 px-1.5 py-0.5 rounded">{selectedPassword}</code>
                      </p>
                      <p className="text-xs mt-1">
                        Format: {selectedEmp?.nik ? 'NIK' : 'NIP (NIK kosong)'} + Tanggal Lahir (DDMMYYYY)
                      </p>
                    </>
                  ) : (
                    <p className="text-xs">
                      NIK & tanggal lahir karyawan belum lengkap — lengkapi di menu Karyawan agar
                      slip bisa dienkripsi.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              File PDF dienkripsi di perangkat ini sebelum dikirim ke server (GAS/Google Drive),
              sehingga yang tersimpan di Drive sudah dalam keadaan terkunci.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

