import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { SectionSkeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Trash2 } from 'lucide-react';

interface Faq {
  id: string;
  question: string;
  answer: string;
  order_index: number;
  is_active: boolean;
}

export const AdminFaqs = () => {
  const { toast } = useToast();
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newQ, setNewQ] = useState('');
  const [newA, setNewA] = useState('');

  const load = async () => {
    const { data } = await supabase
      .from('faqs')
      .select('id, question, answer, order_index, is_active')
      .order('order_index', { ascending: true });
    setFaqs(data || []);
    setIsLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addFaq = async () => {
    if (!newQ.trim() || !newA.trim()) {
      toast({ variant: 'destructive', title: 'Missing fields', description: 'Enter both a question and an answer.' });
      return;
    }
    const nextIndex = (faqs[faqs.length - 1]?.order_index ?? 0) + 1;
    const { error } = await supabase.from('faqs').insert({
      question: newQ.trim(),
      answer: newA.trim(),
      order_index: nextIndex,
    });
    if (error) {
      toast({ variant: 'destructive', title: 'Could not add', description: error.message });
      return;
    }
    setNewQ('');
    setNewA('');
    toast({ title: 'FAQ added' });
    load();
  };

  const saveFaq = async (faq: Faq) => {
    const { error } = await supabase
      .from('faqs')
      .update({ question: faq.question, answer: faq.answer, is_active: faq.is_active })
      .eq('id', faq.id);
    if (error) {
      toast({ variant: 'destructive', title: 'Could not save', description: error.message });
      return;
    }
    toast({ title: 'FAQ updated' });
  };

  const deleteFaq = async (id: string) => {
    const { error } = await supabase.from('faqs').delete().eq('id', id);
    if (error) {
      toast({ variant: 'destructive', title: 'Could not delete', description: error.message });
      return;
    }
    setFaqs((f) => f.filter((x) => x.id !== id));
    toast({ title: 'FAQ deleted' });
  };

  if (isLoading) return <SectionSkeleton rows={4} />;

  return (
    <div className="space-y-6 mt-4">
      <div className="rounded-xl border border-border p-4 space-y-3">
        <p className="font-semibold">Add a new FAQ</p>
        <div>
          <Label>Question</Label>
          <Input value={newQ} onChange={(e) => setNewQ(e.target.value)} placeholder="e.g. How do I reschedule?" />
        </div>
        <div>
          <Label>Answer</Label>
          <Textarea value={newA} onChange={(e) => setNewA(e.target.value)} rows={3} />
        </div>
        <Button onClick={addFaq}>Add FAQ</Button>
      </div>

      <div className="space-y-4">
        {faqs.length === 0 && <p className="text-sm text-muted-foreground">No FAQs yet.</p>}
        {faqs.map((faq, i) => (
          <div key={faq.id} className="rounded-xl border border-border p-4 space-y-3">
            <Input
              value={faq.question}
              onChange={(e) => setFaqs((f) => f.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))}
            />
            <Textarea
              value={faq.answer}
              rows={3}
              onChange={(e) => setFaqs((f) => f.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))}
            />
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={faq.is_active}
                  onChange={(e) => setFaqs((f) => f.map((x, j) => (j === i ? { ...x, is_active: e.target.checked } : x)))}
                />
                Visible
              </label>
              <Button size="sm" onClick={() => saveFaq(faqs[i])}>Save</Button>
              <Button size="sm" variant="destructive" onClick={() => deleteFaq(faq.id)}>
                <Trash2 className="w-4 h-4 mr-1" /> Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};