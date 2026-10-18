import {describe,expect,it} from 'vitest';
import {captureNote,captureInput} from '@/lib/chloe/capture';
import {interpretCommand} from '@/lib/chloe/command';
import {MemoryRepository} from '@/lib/central/memory-repository';
import {CentralService} from '@/lib/central/service';
describe('Captura segura sem modelo',()=>{
 it('preserva texto maior que 500 e apenas sugere duplicata',async()=>{const central=new CentralService(new MemoryRepository());const text='Melhoria da inbox: '+'preservar palavras integralmente. '.repeat(40);await captureNote(central,text);const again=await captureNote(central,text);expect((await central.getEntry(again.registro.id)).content_md).toBe(text);expect(again.duplicates).toHaveLength(1);expect((await central.feed()).total).toBe(2);});
 it('não transforma anotação do feed em monitoramento de preço',()=>{expect(interpretCommand('Ver a questão da aba Para você de verdade')).toMatchObject({kind:'nota'});expect(interpretCommand('vigiar o preço: Ver a questão da aba para você')).not.toMatchObject({kind:'vigia'});});
 it('recusa limite explícito em vez de cortar',()=>{expect(captureInput.safeParse({text:'a'.repeat(50001)}).success).toBe(false);});
});
