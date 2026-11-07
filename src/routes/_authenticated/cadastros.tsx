import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Gauge,
  IdCard,
  Image as ImageIcon,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Truck,
  Upload,
  User,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { api, ensureAdminAuthorization } from "@/lib/api";
import { PageHeader, Plate } from "@/components/fleet-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { brl, driversQuery, vehiclesQuery, type Driver, type Vehicle } from "@/lib/fleet";
import {
  getDriverProfile,
  saveDriverProfile,
  useDriverProfile,
  type DriverProfile,
} from "@/lib/driver-profiles";
import {
  evaluateVehicleMaintenance,
  getAllMaintenanceAlerts,
  MAINTENANCE_TYPE_LABELS,
  useVehicleMaintenance,
  type MaintenanceRecord,
  type MaintenanceType,
} from "@/lib/vehicle-maintenance";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cadastros")({
  head: () => ({
    meta: [
      { title: "Frota, Manutenção & Motoristas — RotaFacil SP" },
      { name: "description", content: "Cadastro de veículos, histórico de manutenções e perfil de condutores." },
      { property: "og:title", content: "Frota, Manutenção & Motoristas — RotaFacil SP" },
      { property: "og:description", content: "Cadastro de veículos, histórico de manutenções e perfil de condutores." },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(vehiclesQuery),
      context.queryClient.ensureQueryData(driversQuery),
    ]),
  component: CadastrosPage,
});

const CNH_CATEGORIES = ["A", "B", "C", "D", "E", "AB", "AC", "AD", "AE"];

function CadastrosPage() {
  const { data: vehicles } = useSuspenseQuery(vehiclesQuery);
  const { data: drivers } = useSuspenseQuery(driversQuery);
  const qc = useQueryClient();

  // Tab State: "veiculos" | "manutencao" | "motoristas" | "todos"
  const [activeTab, setActiveTab] = useState<"veiculos" | "manutencao" | "motoristas" | "todos">("veiculos");

  // State Veículos
  const [v, setV] = useState({ placa: "", modelo: "", km: "" });
  const [vSearch, setVSearch] = useState("");

  // State Motoristas Form
  const [d, setD] = useState({
    nome: "",
    cnh: "",
    telefone: "",
    cnhCategoria: "D",
    cnhValidade: "",
  });
  const [fotoPreview, setFotoPreview] = useState<string>("");
  const [cnhPreview, setCnhPreview] = useState<string>("");
  const [dSearch, setDSearch] = useState("");
  const [submittingDriver, setSubmittingDriver] = useState(false);

  // Modais Motoristas
  const [selectedDriverForCnh, setSelectedDriverForCnh] = useState<Driver | null>(null);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [editFoto, setEditFoto] = useState("");
  const [editCnhFoto, setEditCnhFoto] = useState("");
  const [editCategoria, setEditCategoria] = useState("B");

  const fotoInputRef = useRef<HTMLInputElement>(null);
  const cnhInputRef = useRef<HTMLInputElement>(null);
  const editFotoInputRef = useRef<HTMLInputElement>(null);
  const editCnhInputRef = useRef<HTMLInputElement>(null);

  // Manutenções e Vistorias
  const { records: maintenanceRecords, addRecord: addMaintenance, deleteRecord: deleteMaintenance } = useVehicleMaintenance();
  const maintenanceAlerts = useMemo(() => getAllMaintenanceAlerts(vehicles), [vehicles, maintenanceRecords]);

  // Form State Manutenção
  const [mVehicleId, setMVehicleId] = useState<string>(vehicles[0]?.id || "");
  const [mTipo, setMTipo] = useState<MaintenanceType>("oleo_filtros");
  const [mDescricao, setMDescricao] = useState("");
  const [mKmRegistro, setMKmRegistro] = useState("");
  const [mKmProxima, setMKmProxima] = useState("");
  const [mValidadeVistoria, setMValidadeVistoria] = useState("");
  const [mCusto, setMCusto] = useState("");
  const [mOficina, setMOficina] = useState("");
  const [mObs, setMObs] = useState("");
  const [mFilterVehicle, setMFilterVehicle] = useState<string>("todos");

  // Modal Atualização Rápida de KM
  const [kmUpdatingVehicle, setKmUpdatingVehicle] = useState<{ id: string; placa: string; modelo: string; kmAtual: number } | null>(null);
  const [newKmValue, setNewKmValue] = useState("");

  async function runOp(action: () => Promise<any>, key: string, okMsg: string) {
    const authorized = await ensureAdminAuthorization("modificar dados da frota");
    if (!authorized) return false;

    try {
      await action();
      toast.success(okMsg);
      qc.invalidateQueries({ queryKey: [key] });
      return true;
    } catch (err: any) {
      toast.error(err.message || "Erro na operação");
      return false;
    }
  }

  function handleFileToDataUrl(file: File, callback: (url: string) => void) {
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      toast.error("Formato inválido. Selecione uma imagem (PNG, JPG, WEBP).");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) callback(result);
    };
    reader.readAsDataURL(file);
  }

  async function handleCreateDriver(e: React.FormEvent) {
    e.preventDefault();
    if (!d.nome.trim()) {
      toast.error("Informe o nome do motorista");
      return;
    }

    const authorized = await ensureAdminAuthorization("cadastrar novo motorista");
    if (!authorized) return;

    setSubmittingDriver(true);

    try {
      const newDriver = await api.drivers.create({
        nome: d.nome.trim(),
        cnh: d.cnh.trim(),
        telefone: d.telefone.trim(),
        foto: fotoPreview || undefined,
        cnh_foto: cnhPreview || undefined,
        cnh_categoria: d.cnhCategoria,
        cnh_validade: d.cnhValidade || undefined,
      });

      // Salva anexo de foto e CNH no perfil associado
      const targetId = newDriver?.id || d.cnh.trim() || d.nome;
      saveDriverProfile(
        targetId,
        {
          foto: fotoPreview || undefined,
          cnhFoto: cnhPreview || undefined,
          cnhCategoria: d.cnhCategoria,
          cnhValidade: d.cnhValidade || undefined,
        },
        d.cnh.trim(),
      );

      toast.success("Motorista, foto e CNH cadastrados com sucesso!");
      qc.invalidateQueries({ queryKey: ["drivers"] });

      // Reset
      setD({ nome: "", cnh: "", telefone: "", cnhCategoria: "D", cnhValidade: "" });
      setFotoPreview("");
      setCnhPreview("");
      if (fotoInputRef.current) fotoInputRef.current.value = "";
      if (cnhInputRef.current) cnhInputRef.current.value = "";
    } catch (err: any) {
      toast.error(err.message || "Erro ao cadastrar motorista");
    } finally {
      setSubmittingDriver(false);
    }
  }

  function openEditModal(driver: Driver) {
    setEditingDriver(driver);
    const prof = getDriverProfile(driver.id) || getDriverProfile(driver.cnh);
    setEditFoto(driver.foto || prof?.foto || "");
    setEditCnhFoto(driver.cnh_foto || prof?.cnhFoto || "");
    setEditCategoria(driver.cnh_categoria || prof?.cnhCategoria || "B");
  }

  async function handleSaveEditProfile() {
    if (!editingDriver) return;

    const authorized = await ensureAdminAuthorization("atualizar dados do motorista");
    if (!authorized) return;

    try {
      await api.drivers.update(editingDriver.id, {
        foto: editFoto || undefined,
        cnh_foto: editCnhFoto || undefined,
        cnh_categoria: editCategoria,
      });
      saveDriverProfile(
        editingDriver.id,
        {
          foto: editFoto || undefined,
          cnhFoto: editCnhFoto || undefined,
          cnhCategoria: editCategoria,
        },
        editingDriver.cnh,
      );
      toast.success(`Foto e CNH de ${editingDriver.nome} atualizadas com sucesso!`);
      qc.invalidateQueries({ queryKey: ["drivers"] });
      setEditingDriver(null);
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar dados");
    }
  }

  function openKmUpdateModal(vehicle: Vehicle) {
    setKmUpdatingVehicle({
      id: vehicle.id,
      placa: vehicle.placa,
      modelo: vehicle.modelo,
      kmAtual: vehicle.km_atual,
    });
    setNewKmValue(String(vehicle.km_atual));
  }

  async function handleSaveNewKm() {
    if (!kmUpdatingVehicle) return;
    const n = Number(newKmValue);
    if (Number.isNaN(n) || n < 0) {
      toast.error("Informe um valor de KM válido");
      return;
    }
    try {
      await api.vehicles.update(kmUpdatingVehicle.id, { km_atual: n });
      toast.success(`Hodômetro do veículo ${kmUpdatingVehicle.placa} atualizado para ${n.toLocaleString("pt-BR")} km!`);
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      setKmUpdatingVehicle(null);
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar KM");
    }
  }

  function handleCreateMaintenance(e: React.FormEvent) {
    e.preventDefault();
    if (!mVehicleId) {
      toast.error("Selecione o veículo");
      return;
    }
    const kmReg = Number(mKmRegistro) || 0;
    const kmProx = mKmProxima ? Number(mKmProxima) : undefined;
    const custo = mCusto ? Number(mCusto.replace(",", ".")) : undefined;

    addMaintenance({
      vehicleId: mVehicleId,
      tipo: mTipo,
      descricao: mDescricao.trim() || MAINTENANCE_TYPE_LABELS[mTipo],
      kmRegistro: kmReg,
      kmProxima: kmProx ?? null,
      dataValidadeVistoria: mValidadeVistoria || null,
      oficina: mOficina.trim() || undefined,
      custo: custo ?? undefined,
      observacoes: mObs.trim() || undefined,
    });

    const target = vehicles.find((v) => v.id === mVehicleId);
    if (target && kmReg > target.km_atual) {
      api.vehicles.update(target.id, { km_atual: kmReg }).then(() => {
        qc.invalidateQueries({ queryKey: ["vehicles"] });
      });
    }

    toast.success("Manutenção / Vistoria registrada com sucesso!");
    setMDescricao("");
    setMValidadeVistoria("");
    setMCusto("");
    setMOficina("");
    setMObs("");
    setMKmProxima("");
  }

  const filteredVehicles = useMemo(() => {
    const s = vSearch.toLowerCase().trim();
    if (!s) return vehicles;
    return vehicles.filter(
      (x) => x.placa.toLowerCase().includes(s) || (x.modelo && x.modelo.toLowerCase().includes(s)),
    );
  }, [vehicles, vSearch]);

  const filteredDrivers = useMemo(() => {
    const s = dSearch.toLowerCase().trim();
    if (!s) return drivers;
    return drivers.filter(
      (x) =>
        x.nome.toLowerCase().includes(s) ||
        x.cnh.includes(s) ||
        (x.telefone && x.telefone.includes(s)),
    );
  }, [drivers, dSearch]);

  const filteredMaintenanceHistory = useMemo(() => {
    if (mFilterVehicle === "todos") return maintenanceRecords;
    return maintenanceRecords.filter((r) => r.vehicleId === mFilterVehicle);
  }, [maintenanceRecords, mFilterVehicle]);

  const activeDriverCnhProfile = selectedDriverForCnh
    ? {
        foto: selectedDriverForCnh.foto || (getDriverProfile(selectedDriverForCnh.id) || getDriverProfile(selectedDriverForCnh.cnh))?.foto,
        cnhFoto: selectedDriverForCnh.cnh_foto || (getDriverProfile(selectedDriverForCnh.id) || getDriverProfile(selectedDriverForCnh.cnh))?.cnhFoto,
        cnhCategoria: selectedDriverForCnh.cnh_categoria || (getDriverProfile(selectedDriverForCnh.id) || getDriverProfile(selectedDriverForCnh.cnh))?.cnhCategoria,
      }
    : null;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in-50 duration-300">
      <PageHeader
        title="Frota, Manutenção & Motoristas"
        subtitle="Gerenciamento integrado de veículos, controle preventivo por KM, vistorias e condutores"
        badge={
          maintenanceAlerts.urgentCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 px-3 py-1 text-xs font-bold text-rose-600 dark:text-rose-400 animate-pulse">
              <AlertTriangle size={13} /> {maintenanceAlerts.urgentCount} Manutenção Vencida
            </span>
          ) : maintenanceAlerts.warningCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-xs font-bold text-amber-600 dark:text-amber-400">
              <Clock size={13} /> {maintenanceAlerts.warningCount} Revisão Próxima
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={13} /> Frota em Dia
            </span>
          )
        }
      />

      {/* Navegação por Abas Especializadas */}
      <div className="px-6 sm:px-8">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab("veiculos")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer",
              activeTab === "veiculos"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Truck size={15} /> Veículos da Frota ({vehicles.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("manutencao")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer relative",
              activeTab === "manutencao"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Wrench size={15} /> Manutenção & Vistoria
            {maintenanceAlerts.totalCount > 0 && (
              <span
                className={cn(
                  "ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider",
                  maintenanceAlerts.urgentCount > 0
                    ? "bg-rose-500 text-white animate-pulse"
                    : "bg-amber-500 text-black",
                )}
              >
                {maintenanceAlerts.urgentCount > 0
                  ? `${maintenanceAlerts.urgentCount} VENCIDA`
                  : `${maintenanceAlerts.warningCount} ALERTA`}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("motoristas")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer",
              activeTab === "motoristas"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Users size={15} /> Motoristas & CNH ({drivers.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("todos")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer",
              activeTab === "todos"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <FileText size={15} /> Visão Geral
          </button>
        </div>
      </div>

      {/* Conteúdo da Aba 2: MANUTENÇÃO & VISTORIA PREVENTIVA */}
      {activeTab === "manutencao" && (
        <div className="px-6 sm:px-8 space-y-6">
          {/* Alertas Ativos de Manutenção */}
          {maintenanceAlerts.totalCount > 0 && (
            <div className="space-y-3">
              {maintenanceAlerts.alerts.map((al, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "rounded-2xl border p-4.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm",
                    al.tipo === "vencida"
                      ? "border-rose-500/40 bg-rose-500/10 text-rose-900 dark:text-rose-100"
                      : "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold",
                        al.tipo === "vencida" ? "bg-rose-500 text-white" : "bg-amber-500 text-black",
                      )}
                    >
                      {al.tipo === "vencida" ? <AlertTriangle size={18} /> : <Clock size={18} />}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm tracking-tight flex items-center gap-2">
                        {al.titulo}
                        <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-background/60 border border-border/40">
                          Hodômetro: {al.kmAtual.toLocaleString("pt-BR")} KM
                        </span>
                      </h4>
                      <ul className="mt-1 text-xs space-y-0.5 opacity-90">
                        {al.detalhes.map((det, dIdx) => (
                          <li key={dIdx} className="flex items-center gap-1.5 font-medium">
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {det}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl text-xs gap-1.5 bg-background/80 hover:bg-background"
                      onClick={() => openKmUpdateModal(al.vehicle)}
                    >
                      <Gauge size={13} /> Atualizar Hodômetro
                    </Button>
                    <Button
                      size="sm"
                      className={cn(
                        "rounded-xl text-xs font-bold gap-1.5 shadow-sm text-white",
                        al.tipo === "vencida" ? "bg-rose-600 hover:bg-rose-700" : "bg-amber-600 hover:bg-amber-700",
                      )}
                      onClick={() => {
                        setMVehicleId(al.vehicle.id);
                        setMKmRegistro(String(al.vehicle.km_atual));
                        const formEl = document.getElementById("form-manutencao");
                        formEl?.scrollIntoView({ behavior: "smooth" });
                      }}
                    >
                      <Wrench size={13} /> Registrar Serviço
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Bento KPIs de Manutenção */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Revisão Vencida
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-rose-600 dark:text-rose-400">
                  {maintenanceAlerts.urgentCount}
                </span>
                <span className="text-xs text-muted-foreground">veículos</span>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Revisão Próxima
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                  {maintenanceAlerts.warningCount}
                </span>
                <span className="text-xs text-muted-foreground">atenção preventiva</span>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Veículos em Dia
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {vehicles.filter((x) => x.ativo).length - (maintenanceAlerts.urgentCount + maintenanceAlerts.warningCount)}
                </span>
                <span className="text-xs text-muted-foreground">operacionais</span>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Histórico de Ordens
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-foreground">
                  {maintenanceRecords.length}
                </span>
                <span className="text-xs text-muted-foreground">serviços arquivados</span>
              </div>
            </div>
          </div>

          {/* Cards de Saúde da Frota por Veículo (Hodômetro & Próxima Revisão) */}
          <div className="rounded-2xl border border-border/70 bg-card shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Gauge className="text-primary" size={18} />
                <h3 className="text-sm font-black tracking-tight text-foreground">
                  Status de Manutenção & Hodômetro por Veículo
                </h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Vinculado diretamente à quilometragem de cada veículo
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {vehicles.map((vh) => {
                const health = evaluateVehicleMaintenance(vh, maintenanceRecords);
                return (
                  <div
                    key={vh.id}
                    className={cn(
                      "rounded-xl border p-4 transition-all duration-200 flex flex-col justify-between space-y-3",
                      health.status === "vencida"
                        ? "border-rose-500/50 bg-rose-500/5"
                        : health.status === "proxima"
                        ? "border-amber-500/50 bg-amber-500/5"
                        : "border-border/60 bg-muted/10 hover:border-primary/40",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Plate>{vh.placa}</Plate>
                        <div>
                          <p className="text-xs font-bold text-foreground leading-tight">{vh.modelo}</p>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {vh.ativo ? "Operacional" : "Inativo"}
                          </span>
                        </div>
                      </div>

                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                          health.status === "vencida"
                            ? "bg-rose-500 text-white"
                            : health.status === "proxima"
                            ? "bg-amber-500 text-black"
                            : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30",
                        )}
                      >
                        {health.status === "vencida"
                          ? "Vencida"
                          : health.status === "proxima"
                          ? "Próxima"
                          : "Em Dia"}
                      </span>
                    </div>

                    <div className="bg-card/70 rounded-xl p-3 border border-border/50 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-[11px] flex items-center gap-1 font-semibold">
                          <Gauge size={12} /> Hodômetro Atual:
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-black text-foreground">
                            {vh.km_atual.toLocaleString("pt-BR")} km
                          </span>
                          <button
                            type="button"
                            onClick={() => openKmUpdateModal(vh)}
                            className="text-[10px] font-bold text-primary hover:underline ml-1"
                            title="Editar hodômetro"
                          >
                            Editar
                          </button>
                        </div>
                      </div>

                      {health.proximoKmMenor != null && (
                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/40">
                          <span className="text-muted-foreground">Próxima Revisão:</span>
                          <span className="font-mono font-bold text-foreground">
                            {health.proximoKmMenor.toLocaleString("pt-BR")} km
                            {health.kmFaltantesMenor != null && (
                              <span
                                className={cn(
                                  "ml-1 text-[10px]",
                                  health.kmFaltantesMenor <= 0
                                    ? "text-rose-600 dark:text-rose-400 font-bold"
                                    : "text-muted-foreground",
                                )}
                              >
                                ({health.kmFaltantesMenor <= 0 ? "ultrapassou " : "faltam "}
                                {Math.abs(health.kmFaltantesMenor).toLocaleString("pt-BR")} km)
                              </span>
                            )}
                          </span>
                        </div>
                      )}

                      {health.diasValidadeVistoriaMenor != null && (
                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/40">
                          <span className="text-muted-foreground">Vistoria Veicular:</span>
                          <span
                            className={cn(
                              "font-bold text-[11px]",
                              health.diasValidadeVistoriaMenor <= 0
                                ? "text-rose-600 dark:text-rose-400"
                                : health.diasValidadeVistoriaMenor <= 30
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-emerald-600 dark:text-emerald-400",
                            )}
                          >
                            {health.diasValidadeVistoriaMenor <= 0
                              ? `Vencida (${Math.abs(health.diasValidadeVistoriaMenor)} dias)`
                              : `Em dia (${health.diasValidadeVistoriaMenor} dias restantes)`}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs rounded-xl gap-1 text-primary hover:bg-primary/10"
                        onClick={() => {
                          setMVehicleId(vh.id);
                          setMKmRegistro(String(vh.km_atual));
                          const formEl = document.getElementById("form-manutencao");
                          formEl?.scrollIntoView({ behavior: "smooth" });
                        }}
                      >
                        <Plus size={12} /> Nova Ordem
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Grid: Formulário de Registro + Histórico */}
          <div className="grid gap-6 xl:grid-cols-2">
            {/* Formulário Novo Registro de Manutenção */}
            <div
              id="form-manutencao"
              className="rounded-2xl border border-border/70 bg-card/90 shadow-sm overflow-hidden flex flex-col"
            >
              <div className="border-b border-border/60 p-4 sm:p-5 bg-muted/20 flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                  <Wrench size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold tracking-tight text-foreground">
                    Registrar Manutenção ou Vistoria
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Atualiza o histórico e recalcula automaticamente o alerta de KM
                  </p>
                </div>
              </div>

              <form onSubmit={handleCreateMaintenance} className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Veículo da Frota *</Label>
                    <select
                      required
                      value={mVehicleId}
                      onChange={(e) => {
                        const vId = e.target.value;
                        setMVehicleId(vId);
                        const sel = vehicles.find((v) => v.id === vId);
                        if (sel) {
                          setMKmRegistro(String(sel.km_atual));
                          setMKmProxima(String(sel.km_atual + 10000));
                        }
                      }}
                      className="w-full h-9 rounded-xl border border-border bg-background px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {vehicles.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.placa} — {x.modelo} ({x.km_atual.toLocaleString("pt-BR")} km)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Tipo do Serviço *</Label>
                    <select
                      value={mTipo}
                      onChange={(e) => {
                        const val = e.target.value as MaintenanceType;
                        setMTipo(val);
                        if (!mDescricao) {
                          setMDescricao(MAINTENANCE_TYPE_LABELS[val]);
                        }
                        const curKm = Number(mKmRegistro) || 0;
                        if (val === "oleo_filtros") {
                          setMKmProxima(curKm ? String(curKm + 10000) : "");
                        } else if (val === "freios") {
                          setMKmProxima(curKm ? String(curKm + 25000) : "");
                        } else if (val === "pneus") {
                          setMKmProxima(curKm ? String(curKm + 40000) : "");
                        } else if (val === "vistoria") {
                          const d = new Date();
                          d.setFullYear(d.getFullYear() + 1);
                          setMValidadeVistoria(d.toISOString().split("T")[0]!);
                        }
                      }}
                      className="w-full h-9 rounded-xl border border-border bg-background px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {Object.entries(MAINTENANCE_TYPE_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Descrição do Serviço Realizado</Label>
                  <Input
                    placeholder="Ex: Troca de óleo 5W30, filtro de óleo e filtro de combustível"
                    className="text-xs rounded-xl"
                    value={mDescricao}
                    onChange={(e) => setMDescricao(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">KM do Veículo no Registro *</Label>
                    <Input
                      type="number"
                      required
                      placeholder="Ex: 48210"
                      className="font-mono text-xs rounded-xl"
                      value={mKmRegistro}
                      onChange={(e) => {
                        setMKmRegistro(e.target.value);
                        const vNum = Number(e.target.value);
                        if (vNum && !mKmProxima) {
                          setMKmProxima(String(vNum + 10000));
                        }
                      }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Próxima Manutenção em KM</Label>
                    <Input
                      type="number"
                      placeholder="Ex: 58210"
                      className="font-mono text-xs rounded-xl"
                      value={mKmProxima}
                      onChange={(e) => setMKmProxima(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Validade Vistoria (se houver)</Label>
                    <Input
                      type="date"
                      className="text-xs rounded-xl"
                      value={mValidadeVistoria}
                      onChange={(e) => setMValidadeVistoria(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Custo (R$)</Label>
                    <Input
                      inputMode="decimal"
                      placeholder="0,00"
                      className="font-mono text-xs rounded-xl"
                      value={mCusto}
                      onChange={(e) => setMCusto(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Oficina / Prestador</Label>
                    <Input
                      placeholder="Nome da oficina"
                      className="text-xs rounded-xl"
                      value={mOficina}
                      onChange={(e) => setMOficina(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Observações Técnicas</Label>
                  <Input
                    placeholder="Detalhes adicionais, garantia das peças, etc."
                    className="text-xs rounded-xl"
                    value={mObs}
                    onChange={(e) => setMObs(e.target.value)}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs py-2.5 shadow-md shadow-blue-500/20"
                >
                  <Wrench size={14} className="mr-2" /> Salvar Registro de Manutenção
                </Button>
              </form>
            </div>

            {/* Tabela de Histórico */}
            <div className="rounded-2xl border border-border/70 bg-card/90 shadow-sm overflow-hidden flex flex-col">
              <div className="border-b border-border/60 p-4 sm:p-5 bg-muted/20 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Clock size={17} className="text-primary" />
                  <h3 className="text-sm font-extrabold tracking-tight text-foreground">
                    Histórico de Manutenções
                  </h3>
                </div>

                <select
                  value={mFilterVehicle}
                  onChange={(e) => setMFilterVehicle(e.target.value)}
                  className="h-8 rounded-xl border border-border bg-background px-2.5 text-xs font-medium"
                >
                  <option value="todos">Todos os veículos</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.placa} ({v.modelo})
                    </option>
                  ))}
                </select>
              </div>

              <div className="divide-y divide-border/60 overflow-y-auto max-h-[500px]">
                {filteredMaintenanceHistory.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground space-y-1">
                    <p className="font-semibold">Nenhum registro encontrado.</p>
                    <p className="text-[11px]">Lance manutenções no formulário ao lado.</p>
                  </div>
                ) : (
                  filteredMaintenanceHistory.map((rec) => {
                    const vh = vehicles.find((x) => x.id === rec.vehicleId);
                    return (
                      <div key={rec.id} className="p-4 hover:bg-muted/20 transition-colors space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {vh && <Plate>{vh.placa}</Plate>}
                            <span className="font-bold text-xs text-foreground">
                              {MAINTENANCE_TYPE_LABELS[rec.tipo] || rec.tipo}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-muted-foreground">
                            {rec.dataRegistro}
                          </span>
                        </div>

                        <p className="text-xs text-muted-foreground">{rec.descricao}</p>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
                          <div className="flex items-center gap-3 font-mono text-muted-foreground">
                            <span>KM Serviço: <strong>{rec.kmRegistro.toLocaleString("pt-BR")}</strong></span>
                            {rec.kmProxima != null && (
                              <span>Próx: <strong>{rec.kmProxima.toLocaleString("pt-BR")} km</strong></span>
                            )}
                            {rec.custo != null && (
                              <span className="text-foreground font-semibold">
                                {brl(rec.custo)}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {rec.oficina && (
                              <span className="text-[10px] text-muted-foreground italic">
                                {rec.oficina}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                deleteMaintenance(rec.id);
                                toast.success("Registro removido");
                              }}
                              className="text-muted-foreground hover:text-destructive p-1 rounded-md transition-colors"
                              title="Excluir ordem de manutenção"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo da Aba 1 (Veículos), Aba 3 (Motoristas) ou Aba 4 (Todos) */}
      {(activeTab === "veiculos" || activeTab === "motoristas" || activeTab === "todos") && (
        <div
          className={cn(
            "grid gap-6 px-6 sm:px-8",
            activeTab === "todos" ? "xl:grid-cols-2" : "grid-cols-1",
          )}
        >
          {/* Bento Card: Veículos */}
          {(activeTab === "veiculos" || activeTab === "todos") && (
            <section className="rounded-2xl border border-border/70 bg-card/90 shadow-sm backdrop-blur-xs overflow-hidden flex flex-col">
              <div className="flex items-center justify-between border-b border-border/60 p-5 bg-muted/20">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <Truck size={19} />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold tracking-tight text-foreground">
                      Veículos da Frota
                    </h2>
                    <p className="text-xs text-muted-foreground font-normal">
                      {vehicles.filter((x) => x.ativo).length} operacionais de {vehicles.length} na base
                    </p>
                  </div>
                </div>

                <div className="relative w-36 sm:w-44">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    value={vSearch}
                    onChange={(e) => setVSearch(e.target.value)}
                    placeholder="Buscar placa..."
                    className="h-8 pl-8 text-xs rounded-xl bg-muted/40"
                  />
                </div>
              </div>

              {/* Formulário de Adicionar Veículo */}
              <form
                className="grid grid-cols-[1.1fr_1.4fr_1fr_auto] gap-2 border-b border-border/60 p-4 bg-muted/10"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const ok = await runOp(
                    () =>
                      api.vehicles.create({
                        placa: v.placa.toUpperCase(),
                        modelo: v.modelo,
                        km_atual: Number(v.km) || 0,
                      }),
                    "vehicles",
                    "Veículo cadastrado com sucesso",
                  );
                  if (ok) {
                    setV({ placa: "", modelo: "", km: "" });
                  }
                }}
              >
                <Input
                  required
                  placeholder="Placa (ABC1D23)"
                  className="font-mono uppercase text-xs rounded-xl"
                  value={v.placa}
                  maxLength={8}
                  onChange={(e) => setV({ ...v, placa: e.target.value })}
                />
                <Input
                  placeholder="Modelo (ex: Sprinter, HR)"
                  className="text-xs rounded-xl"
                  value={v.modelo}
                  onChange={(e) => setV({ ...v, modelo: e.target.value })}
                />
                <Input
                  type="number"
                  placeholder="KM atual"
                  className="font-mono text-xs rounded-xl"
                  value={v.km}
                  onChange={(e) => setV({ ...v, km: e.target.value })}
                />
                <Button
                  type="submit"
                  size="icon"
                  className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold shadow-sm"
                  aria-label="Adicionar veículo"
                  title="Cadastrar veículo"
                >
                  <Plus size={16} />
                </Button>
              </form>

              {/* Lista de Veículos */}
              <div className="divide-y divide-border/60 flex-1 overflow-y-auto max-h-[540px]">
                {filteredVehicles.length === 0 ? (
                  <p className="p-8 text-center text-xs text-muted-foreground">
                    Nenhum veículo encontrado.
                  </p>
                ) : (
                  filteredVehicles.map((x) => {
                    const health = evaluateVehicleMaintenance(x, maintenanceRecords);
                    return (
                      <div
                        key={x.id}
                        className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/30"
                      >
                        <Plate>{x.placa}</Plate>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-semibold text-foreground truncate">{x.modelo}</p>
                            {health.status === "vencida" && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-500 text-white">
                                Revisão Vencida
                              </span>
                            )}
                            {health.status === "proxima" && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500 text-black">
                                Revisão Próxima
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-[11px] font-mono text-muted-foreground">
                              {x.km_atual.toLocaleString("pt-BR")} km
                            </p>
                            <button
                              type="button"
                              onClick={() => openKmUpdateModal(x)}
                              className="text-[10px] text-primary hover:underline font-semibold"
                            >
                              Atualizar KM
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[11px] rounded-lg gap-1 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setActiveTab("manutencao");
                              setMFilterVehicle(x.id);
                            }}
                            title="Ver histórico de manutenções deste veículo"
                          >
                            <Wrench size={12} /> Manutenção
                          </Button>

                          <span className="text-[11px] font-medium text-muted-foreground">
                            {x.ativo ? "Ativo" : "Inativo"}
                          </span>
                          <Switch
                            checked={Boolean(x.ativo)}
                            onCheckedChange={(c) =>
                              runOp(
                                () => api.vehicles.update(x.id, { ativo: c }),
                                "vehicles",
                                c ? "Veículo ativado" : "Veículo inativado",
                              )
                            }
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          )}

          {/* Bento Card: Motoristas & Documentos CNH */}
          {(activeTab === "motoristas" || activeTab === "todos") && (
            <section className="rounded-2xl border border-border/70 bg-card/90 shadow-sm backdrop-blur-xs overflow-hidden flex flex-col">
              <div className="flex items-center justify-between border-b border-border/60 p-5 bg-muted/20">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                    <Users size={19} />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold tracking-tight text-foreground">
                      Motoristas & Equipe Autorizada
                    </h2>
                    <p className="text-xs text-muted-foreground font-normal">
                      {drivers.filter((x) => x.ativo).length} habilitados · Registro de foto & CNH digital
                    </p>
                  </div>
                </div>

                <div className="relative w-36 sm:w-44">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    value={dSearch}
                    onChange={(e) => setDSearch(e.target.value)}
                    placeholder="Buscar motorista..."
                    className="h-8 pl-8 text-xs rounded-xl bg-muted/40"
                  />
                </div>
              </div>

              {/* Formulário Completo: Foto do Motorista e CNH */}
              <form
                onSubmit={handleCreateDriver}
                className="border-b border-border/60 p-5 bg-muted/10 space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">
                      Nome do Motorista *
                    </Label>
                    <Input
                      required
                      placeholder="Nome completo"
                      className="text-xs rounded-xl"
                      value={d.nome}
                      onChange={(e) => setD({ ...d, nome: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">
                      Número da CNH *
                    </Label>
                    <Input
                      required
                      placeholder="Registro CNH (11 dígitos)"
                      className="font-mono text-xs rounded-xl"
                      value={d.cnh}
                      maxLength={14}
                      onChange={(e) => setD({ ...d, cnh: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">
                      Telefone / WhatsApp
                    </Label>
                    <Input
                      placeholder="(11) 98888-0000"
                      className="text-xs rounded-xl"
                      value={d.telefone}
                      onChange={(e) => setD({ ...d, telefone: e.target.value })}
                    />
                  </div>
                </div>

                {/* Linha dos campos de Anexo: Foto do Motorista e Documento CNH */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Campo: Foto do Motorista */}
                  <div className="rounded-xl border border-border/70 p-3 bg-card/60 flex items-center gap-3">
                    <input
                      type="file"
                      ref={fotoInputRef}
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileToDataUrl(file, setFotoPreview);
                      }}
                    />

                    <div className="relative h-12 w-12 shrink-0 rounded-full border-2 border-primary/30 overflow-hidden bg-muted flex items-center justify-center">
                      {fotoPreview ? (
                        <img
                          src={fotoPreview}
                          alt="Prévia do Motorista"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <User className="h-6 w-6 text-muted-foreground/60" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">Foto do Motorista</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {fotoPreview ? "Foto anexada com sucesso" : "Selfie ou foto 3x4 do condutor"}
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs rounded-lg gap-1"
                      onClick={() => fotoInputRef.current?.click()}
                    >
                      <Camera size={13} /> {fotoPreview ? "Trocar" : "Anexar"}
                    </Button>
                  </div>

                  {/* Campo: Foto / Arquivo da CNH */}
                  <div className="rounded-xl border border-border/70 p-3 bg-card/60 flex items-center gap-3">
                    <input
                      type="file"
                      ref={cnhInputRef}
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileToDataUrl(file, setCnhPreview);
                      }}
                    />

                    <div className="relative h-12 w-12 shrink-0 rounded-xl border border-border overflow-hidden bg-muted flex items-center justify-center">
                      {cnhPreview ? (
                        <img
                          src={cnhPreview}
                          alt="Prévia da CNH"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <IdCard className="h-6 w-6 text-muted-foreground/60" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">Documento da CNH</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {cnhPreview ? "CNH digital anexada" : "Scan legível frente e verso"}
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs rounded-lg gap-1"
                      onClick={() => cnhInputRef.current?.click()}
                    >
                      <Upload size={13} /> {cnhPreview ? "Trocar" : "Anexar"}
                    </Button>
                  </div>
                </div>

                {/* Linha das Categorias da CNH */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">Categoria CNH:</span>
                    <div className="flex gap-1">
                      {CNH_CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setD({ ...d, cnhCategoria: cat })}
                          className={`h-7 px-2 text-xs font-mono font-bold rounded-lg border transition-all ${
                            d.cnhCategoria === cat
                              ? "bg-primary text-primary-foreground border-primary shadow-xs"
                              : "bg-background text-muted-foreground border-border hover:bg-muted"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={submittingDriver}
                    className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 px-4"
                  >
                    <Plus size={14} className="mr-1" /> Cadastrar Motorista Completo
                  </Button>
                </div>
              </form>

              {/* Lista de Motoristas Cadastrados com Foto & Visualização CNH */}
              <div className="divide-y divide-border/60 flex-1 overflow-y-auto max-h-[540px]">
                {filteredDrivers.length === 0 ? (
                  <p className="p-8 text-center text-xs text-muted-foreground">
                    Nenhum motorista encontrado.
                  </p>
                ) : (
                  filteredDrivers.map((x) => {
                    const prof = getDriverProfile(x.id) || getDriverProfile(x.cnh);
                    const fotoSrc = x.foto || prof?.foto;
                    const cnhFotoSrc = x.cnh_foto || prof?.cnhFoto;
                    const categoria = x.cnh_categoria || prof?.cnhCategoria || "B";

                    return (
                      <div
                        key={x.id}
                        className="flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-muted/30"
                      >
                        {/* Avatar com foto do motorista */}
                        <div className="relative h-11 w-11 shrink-0 rounded-full overflow-hidden border border-border bg-muted flex items-center justify-center">
                          {fotoSrc ? (
                            <img
                              src={fotoSrc}
                              alt={x.nome}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <User className="h-5 w-5 text-muted-foreground/60" />
                          )}
                        </div>

                        {/* Dados do Motorista */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-foreground truncate">{x.nome}</p>
                            <span className="font-mono font-bold text-[10px] px-1.5 py-0.2 rounded bg-primary/15 text-primary border border-primary/20">
                              Cat. {categoria}
                            </span>
                          </div>
                          <p className="text-[11px] font-mono text-muted-foreground">
                            CNH: {x.cnh || "Não informada"} · Tel: {x.telefone || "—"}
                          </p>
                        </div>

                        {/* Botões de Ação: Ver CNH & Editar Perfil */}
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs rounded-xl gap-1.5 border-border/80 hover:bg-muted/60"
                            onClick={() => setSelectedDriverForCnh(x)}
                            title="Visualizar documento e foto da CNH"
                          >
                            <FileCheck2 size={13} className="text-blue-500" />
                            <span className="hidden sm:inline">Ver CNH</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs rounded-xl text-muted-foreground hover:text-foreground"
                            onClick={() => openEditModal(x)}
                            title="Editar dados e anexos"
                          >
                            Editar
                          </Button>

                          <Switch
                            checked={Boolean(x.ativo)}
                            onCheckedChange={(c) =>
                              runOp(
                                () => api.drivers.update(x.id, { ativo: c }),
                                "drivers",
                                c ? "Motorista ativado" : "Motorista inativado",
                              )
                            }
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Modal: Atualização Rápida de Hodômetro / KM do Veículo */}
      <Dialog
        open={Boolean(kmUpdatingVehicle)}
        onOpenChange={(open) => !open && setKmUpdatingVehicle(null)}
      >
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Gauge className="text-primary" size={19} />
              Atualizar Hodômetro do Veículo
            </DialogTitle>
            <DialogDescription className="text-xs">
              Informe a quilometragem atual do hodômetro para recalcular as revisões preventivas.
            </DialogDescription>
          </DialogHeader>

          {kmUpdatingVehicle && (
            <div className="space-y-4 pt-2">
              <div className="p-3 rounded-xl border border-border bg-muted/20 flex items-center justify-between">
                <div>
                  <Plate>{kmUpdatingVehicle.placa}</Plate>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">{kmUpdatingVehicle.modelo}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">KM Anterior</span>
                  <p className="font-mono text-sm font-bold text-foreground">
                    {kmUpdatingVehicle.kmAtual.toLocaleString("pt-BR")} km
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Novo KM Atual do Veículo *</Label>
                <Input
                  type="number"
                  autoFocus
                  placeholder="Ex: 49500"
                  className="font-mono text-lg font-black rounded-xl"
                  value={newKmValue}
                  onChange={(e) => setNewKmValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveNewKm();
                  }}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-xl text-xs"
                  onClick={() => setKmUpdatingVehicle(null)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs"
                  onClick={handleSaveNewKm}
                >
                  Salvar Hodômetro
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Visualizador da Carteira Nacional de Habilitação (CNH) */}
      <Dialog
        open={Boolean(selectedDriverForCnh)}
        onOpenChange={(open) => !open && setSelectedDriverForCnh(null)}
      >
        <DialogContent className="max-w-2xl rounded-2xl p-0 overflow-hidden bg-card border-border/80">
          <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-6 w-6 text-emerald-400" />
                <span className="text-xs font-mono font-bold tracking-widest uppercase text-blue-200">
                  República Federativa do Brasil · Registro Digital CNH
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-4">
              <div className="h-16 w-16 rounded-full overflow-hidden border-2 border-white/50 bg-white/10 shrink-0">
                {activeDriverCnhProfile?.foto ? (
                  <img
                    src={activeDriverCnhProfile.foto}
                    alt={selectedDriverForCnh?.nome}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="h-full w-full p-3 text-white/60" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight">{selectedDriverForCnh?.nome}</h3>
                <p className="text-xs text-blue-200 font-mono">
                  Registro CNH: {selectedDriverForCnh?.cnh || "Não cadastrado"} · Categoria:{" "}
                  <strong className="text-white font-black">
                    {activeDriverCnhProfile?.cnhCategoria || "B"}
                  </strong>
                </p>
                <p className="text-xs text-blue-200 font-mono">
                  Contato: {selectedDriverForCnh?.telefone || "—"}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <IdCard size={15} /> Documento Digitalizado da CNH
            </h4>

            <div className="rounded-xl border border-border/70 overflow-hidden bg-muted/30 flex items-center justify-center min-h-[260px] max-h-[460px]">
              {activeDriverCnhProfile?.cnhFoto ? (
                <img
                  src={activeDriverCnhProfile.cnhFoto}
                  alt="Documento CNH"
                  className="max-h-[440px] w-auto object-contain rounded-lg"
                />
              ) : (
                <div className="p-8 text-center space-y-2 text-muted-foreground">
                  <IdCard className="h-12 w-12 mx-auto text-muted-foreground/40" />
                  <p className="text-xs font-medium">Nenhum scan da CNH anexado a este motorista.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs rounded-xl"
                    onClick={() => {
                      if (selectedDriverForCnh) {
                        openEditModal(selectedDriverForCnh);
                        setSelectedDriverForCnh(null);
                      }
                    }}
                  >
                    <Upload size={12} className="mr-1" /> Anexar CNH Agora
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs text-muted-foreground">
              <span>Status do condutor: <strong>{selectedDriverForCnh?.ativo ? "Ativo" : "Inativo"}</strong></span>
              {activeDriverCnhProfile?.cnhFoto && (
                <a
                  href={activeDriverCnhProfile.cnhFoto}
                  download={`cnh_${selectedDriverForCnh?.nome.replace(/\s+/g, "_")}.png`}
                  className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
                >
                  <Download size={13} /> Baixar CNH
                </a>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Edição de Perfil e Anexos do Motorista */}
      <Dialog
        open={Boolean(editingDriver)}
        onOpenChange={(open) => !open && setEditingDriver(null)}
      >
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              Editar Motorista: {editingDriver?.nome}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Atualize a foto de perfil, o documento da CNH e a categoria habilitada.
            </DialogDescription>
          </DialogHeader>

          {editingDriver && (
            <div className="space-y-4 pt-2">
              <input
                type="file"
                ref={editFotoInputRef}
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileToDataUrl(file, setEditFoto);
                }}
              />
              <input
                type="file"
                ref={editCnhInputRef}
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileToDataUrl(file, setEditCnhFoto);
                }}
              />

              {/* Upload Foto */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Foto do Motorista</Label>
                <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20">
                  <div className="h-12 w-12 rounded-full overflow-hidden border border-border bg-card shrink-0 flex items-center justify-center">
                    {editFoto ? (
                      <img src={editFoto} alt="Foto" className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-6 w-6 text-muted-foreground/60" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-foreground">
                      {editFoto ? "Foto definida" : "Nenhuma foto selecionada"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">JPG, PNG ou WEBP</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs rounded-lg gap-1"
                    onClick={() => editFotoInputRef.current?.click()}
                  >
                    <Upload size={12} /> Alterar Foto
                  </Button>
                </div>
              </div>

              {/* Upload CNH */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Documento / Foto da CNH</Label>
                <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20">
                  <div className="h-12 w-12 rounded-lg overflow-hidden border border-border bg-card shrink-0 flex items-center justify-center">
                    {editCnhFoto ? (
                      <img src={editCnhFoto} alt="CNH" className="h-full w-full object-cover" />
                    ) : (
                      <IdCard className="h-6 w-6 text-muted-foreground/60" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-foreground">
                      {editCnhFoto ? "Documento CNH anexado" : "Nenhuma CNH anexada"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Foto legível ou scan</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs rounded-lg gap-1"
                    onClick={() => editCnhInputRef.current?.click()}
                  >
                    <Upload size={12} /> Alterar CNH
                  </Button>
                </div>
              </div>

              {/* Categoria CNH */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Categoria da CNH</Label>
                <div className="flex gap-1.5">
                  {CNH_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setEditCategoria(cat)}
                      className={`h-7 px-2.5 text-xs font-mono font-bold rounded-lg border transition-all ${
                        editCategoria === cat
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-xl text-xs"
                  onClick={() => setEditingDriver(null)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs"
                  onClick={handleSaveEditProfile}
                >
                  Salvar Alterações
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
