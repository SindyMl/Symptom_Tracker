import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BarChart, Download, TrendingUp, Calendar, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface SymptomEntry {
  id: string;
  symptoms: string[];
  notes: string | null;
  created_at: string;
}

interface RiskAssessment {
  id: string;
  predictions: any;
  risk_level: string;
  created_at: string;
  symptom_entry_id: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [symptomEntries, setSymptomEntries] = useState<SymptomEntry[]>([]);
  const [riskAssessments, setRiskAssessments] = useState<RiskAssessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      const [symptomsResult, assessmentsResult] = await Promise.all([
        supabase
          .from("symptom_entries")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("risk_assessments")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10)
      ]);

      if (symptomsResult.error) throw symptomsResult.error;
      if (assessmentsResult.error) throw assessmentsResult.error;

      const typedSymptoms = (symptomsResult.data || []).map(entry => ({
        id: entry.id,
        symptoms: Array.isArray(entry.symptoms) 
          ? (entry.symptoms as string[])
          : [],
        notes: entry.notes,
        created_at: entry.created_at
      }));
      
      setSymptomEntries(typedSymptoms);
      setRiskAssessments(assessmentsResult.data || []);
    } catch (error: any) {
      toast.error(error.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const exportData = async () => {
    try {
      const csvContent = [
        ["Date", "Symptoms", "Risk Level", "Notes"].join(","),
        ...symptomEntries.map(entry => {
          const assessment = riskAssessments.find(a => a.symptom_entry_id === entry.id);
          return [
            new Date(entry.created_at).toLocaleDateString(),
            `"${entry.symptoms.join(', ')}"`,
            assessment?.risk_level || "N/A",
            `"${entry.notes || ''}"`
          ].join(",");
        })
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `symptom-tracker-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      
      toast.success("Data exported successfully!");
    } catch (error) {
      toast.error("Failed to export data");
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case "high": return "text-destructive";
      case "medium": return "text-accent";
      case "low": return "text-secondary";
      default: return "text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-xl">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-2">Track your health journey</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportData} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Data
          </Button>
          <Button onClick={() => navigate("/symptoms")}>
            Log Symptoms
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Entries</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{symptomEntries.length}</div>
            <p className="text-xs text-muted-foreground">Symptom logs recorded</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Latest Risk Level</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold capitalize ${getRiskColor(riskAssessments[0]?.risk_level || "")}`}>
              {riskAssessments[0]?.risk_level || "None"}
            </div>
            <p className="text-xs text-muted-foreground">From latest analysis</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assessments</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{riskAssessments.length}</div>
            <p className="text-xs text-muted-foreground">AI analyses completed</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Symptom Entries</CardTitle>
            <CardDescription>Your latest logged symptoms</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {symptomEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No symptoms logged yet. Start tracking your health!
                </p>
              ) : (
                symptomEntries.map((entry) => (
                  <div key={entry.id} className="border-l-2 border-primary pl-4 py-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm">
                          {entry.symptoms.join(", ")}
                        </p>
                        {entry.notes && (
                          <p className="text-xs text-muted-foreground mt-1">{entry.notes}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(entry.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Risk Assessments</CardTitle>
            <CardDescription>AI-powered health insights</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {riskAssessments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No assessments yet. Log symptoms to get AI insights!
                </p>
              ) : (
                riskAssessments.map((assessment) => {
                  const topCondition = assessment.predictions?.conditions?.[0];
                  return (
                    <div key={assessment.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <AlertCircle className={`h-4 w-4 ${getRiskColor(assessment.risk_level)}`} />
                          <span className={`text-sm font-medium capitalize ${getRiskColor(assessment.risk_level)}`}>
                            {assessment.risk_level} Risk
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(assessment.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {topCondition && (
                        <div className="text-sm">
                          <p className="font-medium">{topCondition.name}</p>
                          <p className="text-muted-foreground text-xs mt-1">
                            {topCondition.explanation}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Important Disclaimer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This tool provides educational risk assessments only and is NOT a substitute for professional medical advice, 
            diagnosis, or treatment. Always consult a qualified healthcare professional for medical concerns.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;