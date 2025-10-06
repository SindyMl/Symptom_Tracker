import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

const COMMON_SYMPTOMS = [
  "Fever",
  "Cough",
  "Fatigue",
  "Shortness of breath",
  "Headache",
  "Body aches",
  "Sore throat",
  "Loss of taste or smell",
  "Nausea",
  "Vomiting",
  "Diarrhea",
  "Chest pain",
  "Confusion",
  "Persistent pain",
  "Weight loss"
];

const Symptoms = () => {
  const navigate = useNavigate();
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  const toggleSymptom = (symptom: string) => {
    setSelectedSymptoms(prev =>
      prev.includes(symptom)
        ? prev.filter(s => s !== symptom)
        : [...prev, symptom]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedSymptoms.length === 0) {
      toast.error("Please select at least one symptom");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      // Save symptom entry
      const { data: symptomEntry, error: symptomError } = await supabase
        .from("symptom_entries")
        .insert({
          user_id: user.id,
          symptoms: selectedSymptoms,
          notes: notes || null,
        })
        .select()
        .single();

      if (symptomError) throw symptomError;

      // Call AI analysis function
      const { data: analysis, error: analysisError } = await supabase.functions.invoke(
        'analyze-symptoms',
        {
          body: { symptoms: selectedSymptoms }
        }
      );

      if (analysisError) {
        console.error("Analysis error:", analysisError);
        toast.error("Failed to get AI analysis");
      } else if (analysis) {
        // Save risk assessment
        const { error: assessmentError } = await supabase
          .from("risk_assessments")
          .insert({
            symptom_entry_id: symptomEntry.id,
            user_id: user.id,
            predictions: analysis,
            risk_level: analysis.riskLevel || 'medium',
          });

        if (assessmentError) {
          console.error("Assessment error:", assessmentError);
        }

        setAnalysisResult(analysis);
      }

      toast.success("Symptoms logged successfully!");
    } catch (error: any) {
      console.error("Submit error:", error);
      toast.error(error.message || "Failed to log symptoms");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedSymptoms([]);
    setNotes("");
    setAnalysisResult(null);
  };

  const getRiskColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case "high": return "text-destructive";
      case "medium": return "text-accent";
      case "low": return "text-secondary";
      default: return "text-foreground";
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Log Symptoms</h1>
        <p className="text-muted-foreground mt-2">
          Select your symptoms to get AI-powered health insights
        </p>
      </div>

      {!analysisResult ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Your Symptoms</CardTitle>
              <CardDescription>
                Check all symptoms you're currently experiencing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {COMMON_SYMPTOMS.map((symptom) => (
                  <div key={symptom} className="flex items-center space-x-2">
                    <Checkbox
                      id={symptom}
                      checked={selectedSymptoms.includes(symptom)}
                      onCheckedChange={() => toggleSymptom(symptom)}
                    />
                    <Label
                      htmlFor={symptom}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {symptom}
                    </Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Additional Notes</CardTitle>
              <CardDescription>
                Provide any additional details about your symptoms (optional)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Describe when symptoms started, severity, or any other relevant information..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Get AI Analysis
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/dashboard")}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent" />
                AI Analysis Results
              </CardTitle>
              <CardDescription>Based on your reported symptoms</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className={`text-2xl font-bold mb-2 ${getRiskColor(analysisResult.riskLevel)}`}>
                  Risk Level: <span className="capitalize">{analysisResult.riskLevel}</span>
                </h3>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Possible Conditions:</h4>
                <div className="space-y-3">
                  {analysisResult.conditions?.map((condition: any, index: number) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h5 className="font-medium">{condition.name}</h5>
                        <span className="text-sm font-semibold text-accent">
                          {condition.probability}%
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{condition.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Recommendations:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {analysisResult.recommendations?.map((rec: string, index: number) => (
                    <li key={index} className="text-sm">{rec}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <p className="text-xs text-muted-foreground italic">
                  {analysisResult.disclaimer}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button onClick={resetForm} className="flex-1">
              Log Another Entry
            </Button>
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              View Dashboard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Symptoms;