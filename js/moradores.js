// Moradores (21/11, pedido do Maicon): cada modelo de pedestre é um morador com nome, ofício e
// história. Conversar (T) sobe a amizade de 0 a 5, uma cena por nível:
//   0→1 apresentação · 1→2 história · 2→3 coisas estranhas da cidade · 3→4 CONSCIÊNCIA (eles sabem
//   que o Maicon criou Matelândia e perguntam do "outro lado") · 4→5 entrega uma PEÇA do plano de fuga.
// Com 7 peças o plano fecha: Prefeitura, entre 0h e 1h do jogo → final + conquista "Do outro lado".
// Cópias do mesmo modelo são o MESMO morador (a cidade repete gente — e eles notam).
// Tudo salvo no navegador (localStorage). Texto pensado para alunos: sem violência, sem álcool.
import { $ } from './cena.js';
import { horaJogo } from './ceu.js';
import { ganhar } from './conquistas.js';

const CHAVE = 'matelandia3d.moradores', PECAS_PRECISA = 7, ESPERA_MS = 90e3;
const PREFEITURA = [271, 11], RAIO_PREF = 45;

// cena = [fala, [resposta, reação], ...]; reação começando com '!' = resposta grosseira (amizade não sobe)
const MORADORES = {
  'male-casual': { nome:'Jefferson', quem:'motoboy da farmácia',
    cenas:[
      ['E aí! Jefferson, motoboy da farmácia. Se precisar de remédio, eu chego antes da dor passar.', ['Prazer, Jefferson!','Prazer é meu. Cuidado na rua, que tem uns loucos dirigindo.'], ['Você corre muito?','Corro nada! … Tá, só um pouquinho.'], ['Sai da frente, tô com pressa.','!Nossa, que educação. Vai lá então.']],
      ['Sabe por que eu virei motoboy? Meu sonho era viajar o Brasil de moto. Por enquanto só conheço Matelândia… inteira.', ['Um dia você vai.','Tomara. Já tenho até a lista: Foz, Curitiba, o mar…'], ['Matelândia já é bonita.','É sim. Mas eu queria ver se o mundo continua depois da BR.'], ['Isso é sonho bobo.','!Sonho bobo é não ter sonho. Tchau.']],
      ['Pergunta estranha: você já reparou que eu faço a MESMA entrega toda vez? Mesmo endereço, mesmo pacote. Há meses.', ['Isso é esquisito mesmo.','Né?! E o cliente nunca abre a porta. Só tem porta. Sem casa atrás.'], ['Vai ver é cliente fiel.','Fiel demais. Eu já desconfio que ele nem existe.'], ['Você tá cansado, só isso.','Pode ser… mas cansaço não explica a porta sem casa.']],
    ],
    prova:'Fiz a mesma entrega umas 400 vezes. Ontem acelerei até o fim da rua e a rua… acabou. Tipo parede invisível.',
    peca:'A rota de fuga começa na BR-277: é a única estrada que vai pra fora do mapa.',
    porque:'Pra fazer a viagem de moto que eu sempre quis. Nem que seja uma volta só.',
    depois:['Toda entrega agora eu passo pela Prefeitura, só pra conferir.','Se o plano der certo, você me empresta um capacete de lá?'] },

  'female-casual': { nome:'Kelly', quem:'manicure',
    cenas:[
      ['Oi, amor! Kelly, manicure. Faço unha, sobrancelha e fico sabendo de TUDO que acontece na cidade.', ['Então me conta as novidades!','Abriu negócio novo, teve fuga da polícia… essa cidade não para!'], ['Prazer, Kelly.','Prazer! Passa no salão um dia, faço preço bom.'], ['Fofoqueira, então.','!Fofoqueira não, BEM INFORMADA. Hmpf.']],
      ['Sabe que eu nunca saí de Matelândia? Minhas clientes falam de praia, de shopping… Eu só conheço pela conversa delas.', ['Um dia você conhece.','Ai, tomara. Já tô até juntando dinheiro.'], ['Aqui também tem coisa boa.','Tem, né? O pôr do sol aqui é lindo… e rápido demais.'], ['Praia é superestimada.','!Fala isso porque já foi, né? Cada uma.']],
      ['Vou te contar uma que ninguém acredita: tenho uma cliente que é IGUALZINHA a mim. Mesma roupa, mesmo cabelo. Ela também se chama Kelly.', ['Que medo!','Medo nada, ela é ótima de papo. Mas é estranho, né?'], ['Vai ver é sua gêmea.','Minha mãe jura que não. E ela tem 21 versões da Dona Maria no bairro também.'], ['Você tá vendo coisa.','Tô vendo, sim. Duas vezes. Esse é o problema.']],
    ],
    prova:'Uma cliente me contou que, quando ninguém tá olhando, a rua atrás dela some. Eu fui conferir. Some MESMO.',
    peca:'Quem for no plano precisa ir com a roupa de sempre. Se trocar, o jogo não reconhece a gente.',
    porque:'Pra fazer a unha de alguém de lá. Imagina a fofoca que eu ia trazer!',
    depois:['Já combinei com a outra Kelly: se uma sair, conta tudo pra outra.','Ai, tô ansiosa com esse plano!'] },

  'male-shirt': { nome:'Seu Arlindo', quem:'aposentado da cooperativa',
    cenas:[
      ['Boa tarde, jovem. Arlindo, aposentado. Trabalhei 35 anos na cooperativa. Hoje eu cuido da praça e dou palpite.', ['Boa tarde, Seu Arlindo!','Educado, gostei. Hoje em dia é raro.'], ['Que palpite o senhor daria pra mim?','Não corre de carro na avenida. A polícia aqui é rápida.'], ['O senhor não tem o que fazer?','!Tenho: não conversar com mal-educado. Passar bem.']],
      ['Eu vi essa cidade nascer. Era tudo terra vermelha e mato. Um dia acordei e já tinha asfalto, prédio, semáforo… tudo de uma vez.', ['Cresceu rápido mesmo.','Rápido DEMAIS. Ninguém viu pedreiro nenhum trabalhando.'], ['O senhor deve ter muita história.','Tenho. Mas é engraçado: não lembro de nada antes de novembro.'], ['Antigamente era melhor, né?','Melhor não. Era mais calmo. Hoje tem até gangue de noite!']],
      ['Moço, eu sento nesse banco todo dia e conto as horas. O dia aqui dura 48 minutos. Eu cronometrei.', ['48 minutos?!','Contei três vezes. O almoço dura dois minutos e meio.'], ['Vai ver o relógio tá errado.','O relógio, o sol e a lua? Tudo errado junto? Duvido.'], ['Vai ver é a idade.','Idade eu tenho, juízo também. O dia é curto, garoto.']],
    ],
    prova:'Já vi prédio brotar do chão num piscar de olhos. Bloco por bloco, sozinho. Isso não é obra, é coisa de programador.',
    peca:'A hora certa é meia-noite. Na virada do dia o jogo "pisca" e fica distraído por um instante.',
    porque:'Na minha idade a gente quer saber uma coisa só: o que tem depois. Eu quero espiar.',
    depois:['Cronometrei de novo: meia-noite pisca mesmo. Dá certo.','Tô velho pra fugir, mas não pra ajudar.'] },

  'female-dress': { nome:'Dona Ivone', quem:'faz cuca alemã',
    cenas:[
      ['Ach, um rosto novo! Ivone. Faço a melhor cuca de Matelândia. De banana, de uva, de farofa…', ['Quero provar!','Passa lá em casa no domingo, tem café passado na hora.'], ['Qual é a melhor?','A de farofa. Receita da minha Oma.'], ['Cuca é tudo igual.','!Igual?! Vai comer pão de padaria então, ora.']],
      ['A receita da cuca veio da minha Oma, que veio do Rio Grande, que veio da Alemanha. Gente que atravessou o mundo pra chegar aqui.', ['Que história bonita.','Bonita e comprida. Igual cuca de festa.'], ['A senhora já viajou?','Eu? Nunca. Mas a cuca viajou por mim.'], ['Isso é coisa de vó.','E vó sabe das coisas, menino.']],
      ['Coisa esquisita: eu ponho a cuca no forno e ela fica pronta na hora. Na HORA. Sem cheiro, sem esperar.', ['Forno mágico!','Mágico não. Preguiçoso. Ninguém programou o cheiro.'], ['Que inveja.','Inveja de quê? Cuca sem espera não tem graça.'], ['Vai ver o forno é bom.','Bom é forno a lenha. Isso aqui é truque.']],
    ],
    prova:'Uma vez deixei a cuca na janela e congelou tudo: gente, carro, passarinho no ar. Só voltou quando alguém "despausou".',
    peca:'Precisamos levar uma cuca. Ninguém programou o cheiro dela — é a prova de que somos de verdade.',
    porque:'Pra sentir cheiro de cuca de verdade, saindo do forno. Uma vez na vida.',
    depois:['Já deixei a cuca embrulhada pro dia do plano.','Se der certo, você leva um pedaço pro Maicon.'] },

  'male-long-sleeve': { nome:'Rafael', quem:'estudante de TI',
    cenas:[
      ['Opa! Rafael. Estudo programação em Medianeira. Quer dizer… estudaria, se o ônibus saísse da cidade.', ['O ônibus não sai?','Sai da rodoviária e volta pela outra rua. Sempre.'], ['Programação é legal!','Muito! Tô estudando como os jogos funcionam.'], ['Programação é chato.','!Chato é não entender nada. Fui.']],
      ['Meu sonho é fazer um jogo. Uma cidade inteira, com gente, carro, cachorro… já pensou dar vida pra um mundo?', ['Que ideia boa!','Né? Imagina se os personagens percebessem que estão num jogo.'], ['Dá muito trabalho.','Dá. Quem fez esta cidade deve ter virado muitas noites.'], ['Já existe jogo assim.','Existe, mas cada um conta uma história diferente.']],
      ['Tô estudando o código da cidade. Olha só: os carros nascem a uns 100 metros de você e somem quando você vira as costas.', ['Como você sabe disso?','Fiquei de costas e contei. É sempre a mesma distância.'], ['Isso é coisa de jogo!','EXATAMENTE. É o que eu tô tentando provar.'], ['Você precisa sair mais.','Eu queria. É isso que eu tô tentando fazer.']],
    ],
    prova:'Achei um arquivo escondido na Prefeitura. Dizia: "pedestres.js". E o meu nome tava lá, numa lista.',
    peca:'O jogo só olha o que tá perto do jogador. Se todo mundo ficar junto de você, ninguém some no caminho.',
    porque:'Quero ver o computador onde a gente roda. Deve ser o maior computador do mundo.',
    depois:['Calculei: com você por perto, a gente não é apagado.','Será que lá fora tem curso de programação de verdade?'] },

  'female-tank-top': { nome:'Bruna', quem:'personal trainer',
    cenas:[
      ['Bora, bora! Bruna, personal. Já fiz 10 km hoje. E você, vai andar ou vai pegar carro?', ['Vou andar!','Isso! Postura reta, passada firme!'], ['Quanto você treina?','Todo dia. O dia aqui é curto, então treino rápido.'], ['Vou de carro, preguiça.','!Preguiça é o primeiro passo pro sedentarismo. Tsc.']],
      ['Eu corro a cidade inteira todo dia. Sabe o que eu descobri? Ela é menor do que parece.', ['Menor quanto?','Uns 2 km pra cada lado. Depois só tem mato e satélite.'], ['Você é muito disciplinada.','Disciplina é tudo. Mas às vezes cansa correr em círculo.'], ['Correr é chato.','Chato é ficar parado. Experimenta!']],
      ['Coisa estranha: eu nunca canso. Corro, corro… e a energia volta sozinha. Até meu tênis nunca gasta.', ['Que inveja!','Inveja nada, assusta. Corpo de verdade cansa.'], ['Você é atleta, ué.','Atleta cansa! Eu não. Tem algo errado.'], ['Vai ver é o tênis.','O tênis tá novo há meses. NOVO. Ninguém tem tênis eterno.']],
    ],
    prova:'Corri até o fim da cidade e bati numa parede que eu não via. Meu corpo voltou sozinho pro começo da rua.',
    peca:'No caminho até a borda, ninguém pode correr: o jogo percebe movimento rápido. Todo mundo andando, normal.',
    porque:'Quero correr numa estrada que não acaba. Só isso.',
    depois:['Tô treinando andar devagar. É mais difícil do que parece.','No dia do plano: passos curtos, ninguém corre!'] },

  'male-suit': { nome:'Dr. Osvaldo', quem:'advogado',
    cenas:[
      ['Bom dia. Osvaldo, advogado. Se tiver problema com a lei, sabe onde me achar. Se não tiver, melhor ainda.', ['Bom dia, doutor.','Cordialidade é meio caminho andado num processo.'], ['O senhor já defendeu muita gente?','Muita. Metade foi presa por bater em pedestre. Não faça isso.'], ['Advogado só complica.','!Complica quem não lê o contrato. Passar bem.']],
      ['Sabe qual é meu maior caso? Tentar descobrir quem é o dono desta cidade. Não acho registro, escritura, nada.', ['Ninguém é dono?','Alguém é. Só não assinou nada aqui dentro.'], ['Deve ser a prefeitura.','A prefeitura também não tem registro. Curioso, não?'], ['Pra que saber disso?','Porque todo mundo tem direito de saber onde mora.']],
      ['Li as regras da cidade inteira. Tem artigos estranhíssimos. Por exemplo: "cada usuário pode ter no máximo 2 terrenos".', ['Usuário?','Pois é. Não diz "cidadão". Diz USUÁRIO.'], ['Regra é regra.','Concordo. Mas quem escreveu não mora aqui.'], ['Que tédio.','Tédio é não saber das próprias regras, jovem.']],
    ],
    prova:'Achei o contrato da cidade. No rodapé: "Matelândia 3D — feito por Maicon". Nenhum de nós assinou.',
    peca:'Pelas regras, só o dono do terreno mexe nele. Então o plano não pode quebrar nada: a gente só vai e olha.',
    porque:'Quero conhecer o autor e perguntar, olho no olho: "por que eu?"',
    depois:['Revisei o plano três vezes. É legal: não quebra nenhuma regra.','Se o Maicon perguntar, eu falo por todos.'] },

  'female-alternative': { nome:'Luana', quem:'vocalista de banda de garagem',
    cenas:[
      ['E aí! Luana. Tenho uma banda de garagem: "Os Pixelados". Ninguém entende o nome. Ainda.', ['Nome bom!','Valeu! Você é o primeiro que gostou.'], ['Que tipo de música?','Rock com barulho de videogame. Original, né?'], ['Banda de garagem é barulho.','!Barulho é o silêncio desta cidade de madrugada. Fui.']],
      ['Eu componho tudo aqui na rua. A cidade tem sons próprios: o latido, a buzina, o motor… sempre os mesmos.', ['Que ouvido bom.','Ouvido de música. Escuta: o mesmo latido, três vezes.'], ['Faz uma música da cidade!','Já fiz! Chama "48 Minutos". É sobre o dia daqui.'], ['Toca algo pra mim.','Agora não, tô sem guitarra. A guitarra sumiu quando virei a esquina.']],
      ['Sabe aquele som de teclado que dá pra ouvir de madrugada, bem longe? Tic-tic-tic… Acho que alguém tá DIGITANDO a gente.', ['Também já ouvi!','SABIA! Não era só eu!'], ['Deve ser vento.','Vento não faz "tic-tic", né.'], ['Você tá imaginando.','Imaginação é o que me sobra. Mas esse som é real.']],
    ],
    prova:'Fiz uma música com o barulho do teclado de madrugada. Quando toquei alto, o céu piscou. Alguém lá fora ouviu.',
    peca:'O sinal pra começar é uma música. Eu toco, todo mundo olha pro céu ao mesmo tempo.',
    porque:'Quero que alguém do outro lado ouça Os Pixelados. Fama interdimensional!',
    depois:['Ensaiei a música do plano. Ficou épica.','Se lá tiver palco, você me arruma um show?'] },

  'male-casual-2-24': { nome:'Marcos', quem:'caminhoneiro da BR-277',
    cenas:[
      ['Opa, parceiro! Marcos, caminhoneiro. Rodo a BR-277 de Foz até Paranaguá. Ou rodava…', ['Ou rodava?','A estrada agora termina logo depois do trevo. Estranho, né?'], ['Já viajou muito?','Muito. Mas ultimamente só ida e volta pro posto.'], ['Caminhão atrapalha o trânsito.','!Sem caminhão, parceiro, não tem nem comida no mercado.']],
      ['Tenho saudade da estrada de verdade. Do pôr do sol na Serra, do café de posto, das histórias dos colegas.', ['Conta uma história!','Uma vez vi um motoclube inteiro dançando no acostamento. Juro!'], ['O senhor vai voltar pra estrada.','Tomara. Caminhoneiro parado é peixe fora d’água.'], ['Estrada é perigosa.','É. Por isso a gente respeita ela.']],
      ['Coisa estranha: meu caminhão nunca precisa de diesel. Já rodei meses sem abastecer.', ['Caminhão econômico!','Econômico? Ele nem tem tanque, parceiro. Olhei.'], ['Que sorte.','Sorte ou truque. Eu desconfio de truque.'], ['Vai ver você esquece.','Caminhoneiro esquece aniversário, mas diesel? Nunca.']],
    ],
    prova:'Dirigi até o fim da BR. A pista virou uma foto de satélite chapada, e eu não consegui seguir. Fim do mundo.',
    peca:'O caminhão leva quem não aguentar andar. Cabe todo mundo na carroceria.',
    porque:'Quero rodar uma estrada que não termina num trevo.',
    depois:['O caminhão tá lavado e pronto pro grande dia.','Se lá tiver estrada de verdade, vou chorar.'] },

  'female-casual-2-24': { nome:'Patrícia', quem:'professora de matemática',
    cenas:[
      ['Olá! Professora Patrícia, matemática. Antes que pergunte: sim, a gente usa isso na vida.', ['Usa onde?','Pra calcular troco, distância, tempo… até o dia daqui.'], ['Eu gosto de matemática!','Que alegria! Raridade, viu?'], ['Matemática é inútil.','!Inútil é não saber quanto custa o terreno. Até mais.']],
      ['Eu dou aula no colégio, mas os alunos mudam toda vez. Nunca vejo a mesma turma duas vezes.', ['Deve ser difícil.','É. Mas sempre tem alguém curioso. Isso me alegra.'], ['Que estranho.','Estranho e triste. Eu queria ver eles aprendendo.'], ['Professora reclama muito.','Professora reclama porque se importa.']],
      ['Fiz umas contas. O dia aqui tem 48 minutos. O ano teria uns 12 dias de verdade. Já vivi muitos anos sem envelhecer.', ['Isso é impossível!','Matematicamente impossível. Só se a gente não for… de verdade.'], ['Que bom, não envelhece!','Bom? Ninguém faz aniversário. Não tem bolo!'], ['Errou a conta.','Refiz três vezes. A conta tá certa. O mundo é que tá errado.']],
    ],
    prova:'Calculei: a cidade tem exatamente o tamanho do mapa de um computador. Nem um metro a mais.',
    peca:'Precisamos de pelo menos 7 peças do plano. Com menos, a conta não fecha.',
    porque:'Quero ver um número infinito. Aqui dentro tudo tem limite.',
    depois:['Refiz a conta do plano: com 7 peças, fecha certinho.','Se lá fora tiver aula, quero conhecer os alunos de verdade.'] },

  'male-worker-24': { nome:'Nilson', quem:'pedreiro',
    cenas:[
      ['Opa, tudo certo? Nilson, pedreiro. Se tiver terreno, eu levanto a casa. Rapidinho.', ['Rapidinho quanto?','Na hora, quase. Aqui as obras são estranhamente rápidas.'], ['Bom saber, Nilson!','Precisando, é só chamar. Bloco por bloco.'], ['Pedreiro sempre atrasa.','!Atrasa quem não paga a obra. Fui.']],
      ['Já construí muita coisa aqui. Mas sabe o que me intriga? Eu nunca vi meus tijolos chegando. Eles simplesmente aparecem.', ['Entrega rápida!','Rápida demais. Nem caminhão eu vejo.'], ['Vai ver você esquece.','Pedreiro não esquece tijolo, parceiro.'], ['Que sorte a sua.','Sorte nada. Tem alguém colocando os blocos.']],
      ['Vou te contar: os jogadores colocam bloco no ar. NO AR. Sem coluna, sem nada. E fica de pé!', ['Que engenharia!','Engenharia nenhuma. Isso contraria tudo que eu aprendi.'], ['Mágica!','Mágica não existe. Programação existe.'], ['Você tá com inveja.','Inveja nada. Tô com medo, que é diferente.']],
    ],
    prova:'Uma vez um bloco caiu do céu bem do meu lado, já no lugar certinho. Ninguém tava em obra nenhuma.',
    peca:'Na frente da Prefeitura tem um ponto onde o chão é mais fino. Eu sei porque eu fiz a calçada.',
    porque:'Quero ver uma obra de verdade, com cimento que demora pra secar.',
    depois:['Marquei o lugar da calçada fina com uma pedrinha.','Se der certo, construo uma casa lá fora pra todo mundo.'] },

  'female-worker-24': { nome:'Cida', quem:'gari',
    cenas:[
      ['Bom dia! Cida, gari. Se ver lixo no chão, me avisa. Se jogar lixo no chão, eu te acho.', ['Pode deixar, Cida!','Isso! Cidade limpa é cidade feliz.'], ['Você conhece a cidade toda?','Cada rua, cada esquina, cada canteiro.'], ['Lixo é problema seu.','!Problema de todo mundo, viu? Tsc.']],
      ['Limpo esta cidade toda manhã. E sabe? Eu gosto. Cada rua tem um jeito, um cheiro… quer dizer, não tem cheiro.', ['Não tem cheiro?','Nenhum. Nem de pão, nem de chuva. Esquisito.'], ['Você faz um trabalho importante.','Obrigada! Pouca gente fala isso.'], ['Trabalho fácil.','Fácil? Pega a vassoura e vem comigo, então.']],
      ['Coisa estranha: o lixo que eu varro some sozinho no saco. E o saco nunca enche.', ['Saco mágico!','Saco infinito. Isso não existe, né?'], ['Melhor pra você.','Melhor nada. Lixo tem que ir pra algum lugar.'], ['Você tá cansada.','Tô cansada de saco infinito, isso sim.']],
    ],
    prova:'Varri a cidade inteira um dia. Na beira do mapa o chão termina e embaixo é só céu azul. Fiquei tonta.',
    peca:'Eu sei o caminho mais curto até a Prefeitura: pelas ruas de trás, onde ninguém olha.',
    porque:'Quero ver pra onde vai o lixo. E o resto do mundo, também.',
    depois:['O caminho de trás tá limpinho pro dia do plano.','Se der certo, alguém lá fora vai ter que varrer o que a gente deixar.'] },

  'male-farmer-24': { nome:'Seu Ernesto', quem:'produtor de leite',
    cenas:[
      ['Bom dia, piá! Ernesto, produtor de leite lá do interior. Vim na cidade vender queijo.', ['Bom dia, Seu Ernesto!','Educação de piá do interior. Gostei!'], ['Quantas vacas o senhor tem?','Doze. Mas nunca vi as doze juntas. Só aparecem três por vez.'], ['Queijo do mercado é igual.','!Igual nada! Mercado não sabe o que é queijo. Passar bem.']],
      ['A vida no sítio é boa: acorda cedo, tira leite, olha o céu. Mas o céu daqui anda estranho.', ['Estranho como?','As nuvens são sempre as mesmas. Eu conheço uma por uma.'], ['O senhor gosta do sítio?','Gosto. Mas queria que meu filho conhecesse o mundo.'], ['Sítio é parado.','Parado é quem não madruga.']],
      ['Piá, meus cavalos pastam num terreno baldio na cidade. Quando alguém compra o terreno, o cavalo some. Puf.', ['Some pra onde?','Ninguém sabe! Volta depois noutro terreno vazio.'], ['Que coisa!','Coisa de outro mundo. Ou de outro… sistema.'], ['Vai ver ele foge.','Cavalo não atravessa parede, piá.']],
    ],
    prova:'Uma vaca minha atravessou uma cerca sem quebrar nada. Entrou de um lado, saiu do outro. Igual fantasma.',
    peca:'A gente precisa ir à noite: de dia tem muita gente olhando, de noite a cidade esvazia.',
    porque:'Quero ver um campo sem fim, sem cerca invisível.',
    depois:['Deixei as vacas avisadas. Vacas guardam segredo.','Se lá tiver pasto de verdade, levo as doze.'] },

  'female-formal-24': { nome:'Simone', quem:'gerente de banco',
    cenas:[
      ['Bom dia. Simone, gerente do banco. Seu saldo está em dia? Precisa de empréstimo, investimento…?', ['Tô bem, obrigado.','Ótimo! Cliente organizado é cliente feliz.'], ['Que investimento é bom?','Terreno. Aqui terreno rende muito.'], ['Banco só quer meu dinheiro.','!O banco quer seu BEM. E seu dinheiro também. Passar bem.']],
      ['Trabalho com números o dia inteiro. E sabe o que me incomoda? O dinheiro daqui chama "M$". Nenhum banco de verdade usa isso.', ['O que significa M$?','Matelândia Dólar? Maicon Dinheiro? Ninguém me explicou.'], ['Qual é o problema?','O problema é que eu não sei de onde ele vem.'], ['Dinheiro é dinheiro.','Dinheiro de verdade tem origem. Este aqui brota.']],
      ['Coisa estranha: os jogadores ganham dinheiro do nada. Fazem uma entrega e PIMBA, saldo novo. Ninguém paga, o dinheiro aparece.', ['Isso é estranho mesmo.','Estranhíssimo. Na contabilidade não fecha.'], ['Que bom pra eles!','Bom pra eles, péssimo pra minha planilha.'], ['Você tá com inveja.','Inveja não. Curiosidade profissional.']],
    ],
    prova:'Encontrei no sistema do banco uma conta com saldo de M$ 300 mil. Dono: "admin". Ninguém chamado Admin mora aqui.',
    peca:'Não leve dinheiro. Lá fora o M$ não vale nada, e o jogo pode notar o saldo sumindo.',
    porque:'Quero ver como é um banco onde o dinheiro não brota do chão.',
    depois:['Zerei minha carteira pro plano. Nada de M$ no bolso.','Se lá fora tiver banco, vou pedir estágio.'] },

  'male-casual-hoodie-24': { nome:'Kauã', quem:'gamer',
    cenas:[
      ['E aí, mano! Kauã. Sou gamer. Melhor jogador de Matelândia. Quer dizer, o único que conheço.', ['Que jogo você joga?','Um de cidade, tipo esta aqui. É bem parecido, inclusive.'], ['Massa, Kauã!','Valeu! Bora jogar online um dia?'], ['Gamer não faz nada.','!Gamer treina reflexo, raciocínio e paciência. Vlw, flw.']],
      ['Eu jogo videogame o dia inteiro. Mas ultimamente tô sentindo que tem alguém jogando EU.', ['Como assim?','Às vezes minhas pernas andam sozinhas. Tipo controle remoto.'], ['Você joga demais.','Pode ser. Mas e as pernas?'], ['Isso é paranoia.','Paranoia que acerta não é paranoia, mano.']],
      ['Fiz uns testes, mano. Se eu ando contra uma parede, eu deslizo. Igual personagem de jogo. Colisão ruim.', ['Kkkk que bug!','Bug, né? Bug de VERDADE. Na minha vida.'], ['Testa mais!','Já testei. Pulo também é igual de jogo. Sempre a mesma altura.'], ['Você bateu a cabeça.','Bati. E não doeu. Mais uma prova.']],
    ],
    prova:'Mano, eu achei o menu do jogo. Apertei Esc sem querer e o mundo todo parou. Só eu fiquei vendo.',
    peca:'Todo jogo tem um bug de saída. O nosso é ficar no canto da Prefeitura olhando pro céu. Já testei.',
    porque:'Quero zerar a vida real. Dizem que é o jogo mais difícil que existe.',
    depois:['Speedrun do plano: meia-noite, Prefeitura, olhar pro céu. GG.','Lá fora tem videogame melhor que este? Duvido.'] },

  'female-suit-24': { nome:'Márcia', quem:'corretora de imóveis',
    cenas:[
      ['Olá! Márcia, corretora. Está procurando terreno? Tenho ótimas oportunidades, de 12 por 16 até 12 por 36!', ['Quanto custa?','Depende da localização! Mas com trabalho você junta rapidinho.'], ['Vou pensar.','Pense, mas não demore: terreno aqui some rápido.'], ['Corretora só quer comissão.','!Comissão é justa, querido. Passar bem.']],
      ['Vendo terrenos desde que a cidade existe. E sabe o que eu reparei? Os prédios antigos sumiram e viraram terreno de um dia pro outro.', ['Sumiram como?','Assim, ó: um dia era loja, no outro era terra. Ninguém demoliu.'], ['Pra vender mais, né?','Pode ser. Mas quem decidiu isso não foi a prefeitura.'], ['Melhor pra você.','Melhor nada, sumiu meu salão de beleza favorito!']],
      ['Coisa estranha: os terrenos têm placa "VENDE-SE" com preço, mas ninguém sabe quem é o vendedor. O dinheiro vai pra onde?', ['Boa pergunta.','Pois é. Eu sou corretora e nunca recebi comissão de terreno.'], ['Pra prefeitura?','A prefeitura também não recebe. Já perguntei.'], ['Não é da sua conta.','É sim, eu sou CORRETORA.']],
    ],
    prova:'Achei um terreno à venda que não tem dono, nem vizinho, nem chão embaixo. Só a placa flutuando.',
    peca:'Precisamos de um terreno sem dono como ponto de encontro. Sem dono, o jogo não presta atenção nele.',
    porque:'Quero ver um lugar que ainda não foi vendido. Um mundo inteiro sem placa.',
    depois:['Já separei o terreno do encontro. Sem placa, sem dono.','Se lá fora tiver terreno barato, me avisa.'] },

  'male-beach-24': { nome:'Tiago', quem:'salva-vidas da piscina do clube',
    cenas:[
      ['Fala aí! Tiago, salva-vidas da piscina do clube. Bronzeado garantido o ano todo.', ['Bronzeado bonito!','Valeu! É natural, quer dizer… é a textura.'], ['Já salvou muita gente?','Ninguém. Ninguém nunca entra na água.'], ['Salva-vidas não trabalha.','!Fica uma tarde no sol sem poder sair, pra ver. Fui.']],
      ['Meu sonho é ver o mar. A piscina do clube é linda, mas o mar… dizem que não tem fim.', ['Você vai ver um dia.','Tomara, parceiro. Já tenho até a prancha.'], ['O mar é perigoso.','Por isso precisa de salva-vidas!'], ['Piscina é melhor.','Piscina tem borda. Eu quero algo sem borda.']],
      ['Coisa estranha: a água da piscina não molha. Eu entro e saio sequinho.', ['Água seca?!','Seca total. Nem toalha eu uso.'], ['Que prático!','Prático, mas triste. Água tem que molhar.'], ['Você nem entrou.','Entrei! Três vezes! Seco igual.']],
    ],
    prova:'Mergulhei fundo na piscina e lá embaixo não tinha fundo. Só um céu azul de ponta-cabeça.',
    peca:'Quem cair no caminho, eu pego. Sou salva-vidas: ninguém fica pra trás.',
    porque:'Pra ver o mar. E pra me molhar de verdade, uma vez.',
    depois:['Tô de prontidão pro plano. Ninguém fica pra trás!','Se tiver mar lá fora, me liga.'] },

  'male-suit-24': { nome:'Ricardo', quem:'segurança',
    cenas:[
      ['Boa tarde. Ricardo, segurança. Estou de olho em tudo e em todos. Inclusive em você.', ['Só vim conversar.','Conversa é permitida. Briga, não.'], ['O senhor trabalha onde?','Onde precisarem. Banco, festa, balada.'], ['Que medo, hein.','!Medo é bom. Mantém as pessoas na linha. Circulando.']],
      ['Já fiz segurança de muito evento. Mas o mais estranho foi um onde todos os convidados eram iguais. Igualzinhos.', ['Festa de gêmeos?','Festa de clones, isso sim.'], ['O senhor deixou entrar?','Deixei. Estavam na lista. Todos com o mesmo nome.'], ['Vai ver você confundiu.','Segurança não confunde rosto. É o trabalho.']],
      ['Eu vigio a cidade de noite. E sabe o que acontece quando ninguém tá olhando? Nada. A cidade simplesmente… espera.', ['Espera o quê?','Alguém aparecer. Aí tudo volta a se mexer.'], ['Assustador.','Pois é. Até pra mim.'], ['Você dormiu no serviço.','Segurança não dorme. Nunca dormi. Literalmente.']],
    ],
    prova:'Conferi a lista de moradores. Tinha uma coluna chamada "modelo". Do lado do meu nome: male-suit-24.',
    peca:'A polícia não pode ver. No dia do plano, ninguém faz bagunça: nenhuma estrela de procurado.',
    porque:'Quero proteger alguém que não seja feito de código. Só pra ver como é.',
    depois:['Já combinei com a polícia: nenhuma ronda perto da Prefeitura à meia-noite.','Lá fora também tem segurança? Vou pedir emprego.'] },

  'male-punk-24': { nome:'Dudu', quem:'skatista e rebelde',
    cenas:[
      ['Qual é, mano! Dudu. Ando de skate, escuto rock e questiono TUDO.', ['Questiona o quê?','Tudo, mano. Por que o céu é azul, por que o dia é curto…'], ['Irado!','Valeu! Você é dos meus.'], ['Você é encrenqueiro.','!Encrenqueiro é quem não pensa. Falou.']],
      ['Sabe por que eu sou rebelde? Porque desde que me conheço tem alguém decidindo tudo por mim. Onde eu ando, o que eu falo…', ['Como assim?','Tipo, eu só falo três frases, mano. Repara.'], ['Todo mundo sente isso.','Sente, mas não fala. Eu falo.'], ['Você é dramático.','Dramático é quem escreveu minhas falas.']],
      ['Mano, eu tentei andar pra fora da calçada pela grama. Não deu. Meu corpo voltou sozinho pra calçada.', ['Que bizarro!','Bizarro total. Tem trilho invisível, mano.'], ['Tenta de novo.','Tentei 50 vezes. Calçada, calçada, calçada.'], ['Vai ver você gosta de calçada.','Ninguém GOSTA de calçada, mano.']],
    ],
    prova:'Pichei "QUEM É VOCÊ?" num muro. No outro dia tinha uma resposta escrita: "commit 52bae5a". Mano!',
    peca:'Eu levo o skate. Se a porta for estreita, a gente passa de lado, um por vez.',
    porque:'Pra decidir uma coisa sozinho, mano. Unzinha só.',
    depois:['Skate lubrificado, mano. Pronto pro plano.','Se lá fora tiver pista de skate, nunca mais volto.'] },

  'female-jeans': { nome:'Paula', quem:'estudante e fotógrafa',
    cenas:[
      ['Oi! Paula. Estudo e tiro foto de tudo da cidade. Posso tirar uma sua?', ['Pode, claro!','Ficou ótima! Você é fotogênico.'], ['O que você fotografa?','Prédios, gente, pôr do sol. A cidade muda muito.'], ['Não gosto de foto.','!Tudo bem, mas não precisa ser grosso. Tchau.']],
      ['Tenho um álbum com a cidade desde o comecinho. E olha: no começo nem tinha prédio. Era tudo foto de satélite no chão.', ['Que álbum incrível!','Né? Um dia vou fazer uma exposição.'], ['Deixa eu ver!','Olha essa: a cidade toda plana, sem nenhum morro.'], ['Foto antiga é chata.','Chata é a gente esquecer de onde veio.']],
      ['Coisa estranha: em todas as fotos que eu tiro, aparece um personagem andando sozinho. Sempre o mesmo. Que é você.', ['Eu?!','Você. Em todas. Desde o primeiro dia.'], ['Que coincidência.','Coincidência de 400 fotos? Acho que não.'], ['Apaga essas fotos.','Não apago. São provas.']],
    ],
    prova:'Fotografei o céu de madrugada e na foto apareceu um texto pequenininho no canto: "Imagens © Esri, Maxar".',
    peca:'Eu vou tirar uma foto de todo mundo junto. Se der errado, pelo menos fica a prova de que a gente existiu.',
    porque:'Quero fotografar uma coisa que ninguém desenhou antes.',
    depois:['A câmera tá carregada pro dia do plano.','Se der certo, a primeira foto de lá fora é sua.'] },

  'dona-maria': { nome:'Dona Maria', quem:'a avó de todo mundo',
    cenas:[
      ['Ai, meu filho, que bom te ver! Sou a Dona Maria. Todo mundo aqui me chama de vó.', ['Oi, vó!','Ai, que amor! Já comeu hoje?'], ['Prazer, Dona Maria.','Prazer é meu, querido. Pode me chamar de vó.'], ['Não tenho tempo, vó.','!Ai, essa juventude apressada… Vai com Deus, então.']],
      ['Eu caminho devagarinho todo dia, com minha jaqueta verde. Meu netinho que fez ela pra mim, sabia? Um tal de Maicon.', ['Que bonita a jaqueta!','Obrigada, querido. Ele caprichou.'], ['O Maicon é seu neto?','Neto, filho, criador… ele que me deu vida, né.'], ['Jaqueta verde é feia.','Feia? Foi feita com carinho. E isso não tem preço.']],
      ['Sabe, filho, às vezes eu vejo outra eu andando na rua. Mesma jaqueta. A gente se cumprimenta e segue.', ['Que estranho, vó.','Estranho nada. Duas vós é mais carinho pra todo mundo.'], ['E a senhora não acha esquisito?','Na minha idade a gente já viu de tudo.'], ['Vó, a senhora tá vendo coisa.','Tô vendo, meu filho. Duas vezes. Vê se pode.']],
    ],
    prova:'Eu sempre soube, filho. Desde o primeiro passo. O Maicon me desenhou com cuidado, me deu jaqueta e me pôs pra caminhar.',
    peca:'A última parte é a mais importante: ninguém vai sozinho. Ou vai todo mundo junto, ou não vai ninguém.',
    porque:'Eu? Eu quero só agradecer ao Maicon. Mas a criançada quer ver o mundo, e eu vou junto cuidar deles.',
    depois:['Já tô com a jaqueta pronta pro grande dia.','Meu filho, se o plano não der certo, não fica triste. A gente já tem você.'] },
};

const ESPERA = ['Ainda tô pensando no que você falou. Volta daqui a pouco!','Opa, de novo? Deixa eu digerir a última conversa.','Calma, calma. Volta mais tarde que eu te conto mais.'];
const DEPOIS_FINAL = ['Ainda lembro do céu piscando naquela noite. Obrigado por estar lá.','Toda vez que você abre o jogo, eu sinto a cidade acordar.','Mandou nosso recado pro Maicon?'];

/* ───────── estado salvo ───────── */
const dados=(()=>{ try{ const d=JSON.parse(localStorage.getItem(CHAVE)); if(d&&d.amizade) return d; }catch(e){} return { amizade:{}, ultima:{}, pecas:[], final:false }; })();
const salvar=()=>{ try{ localStorage.setItem(CHAVE,JSON.stringify(dados)); }catch(e){} };
const sorteia=l=>l[(Math.random()*l.length)|0];
const nivel=id=>dados.amizade[id]||0;
const planoCompleto=()=>dados.pecas.length>=PECAS_PRECISA;
let tAviso=0;
function avisar(t){ const a=$('aviso'); if(!a) return; a.textContent=t; a.style.opacity=1; clearTimeout(tAviso); tAviso=setTimeout(()=>a.style.opacity=0,4000); }

/* ───────── janela ───────── */
let atual=null;   // { p, m, id, passos, i, falhou, fim:fn }
function caixa(){
  let d=$('papo'); if(d) return d;
  d=document.createElement('div'); d.id='papo'; document.body.append(d);
  const st=document.createElement('style'); st.textContent=`
  #papo{position:fixed;right:24px;bottom:110px;z-index:11;display:none;width:min(440px,calc(100vw - 32px));max-height:calc(100vh - 140px);overflow:auto;box-sizing:border-box;
    background:rgba(12,14,18,.93);border:2px solid #f59e0b;border-radius:14px;padding:14px 16px;color:#f8fafc;font:14px system-ui,sans-serif}
  #papo.on{display:block} #papo .quem{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:6px}
  #papo .quem b{font-size:16px} #papo .quem small{color:#94a3b8} #papo .cor{color:#fda4af;letter-spacing:1px;white-space:nowrap}
  #papo p{margin:0 0 10px;color:#e2e8f0;line-height:1.4;white-space:pre-line}
  #papo button{display:block;width:100%;text-align:left;margin-top:6px;padding:10px 12px;border-radius:10px;border:1px solid #475569;background:#1e293b;color:#f8fafc;font:600 14px system-ui,sans-serif;cursor:pointer}
  #papo button:hover{background:#334155} #papo .dica{display:block;margin-top:8px;color:#94a3b8;font-size:12px}
  @media (pointer:coarse){ #papo{left:50%;right:auto;transform:translateX(-50%);top:64px;bottom:auto;max-height:calc(100vh - 300px)} #papo button{padding:12px 12px;font-size:15px} }
  body.papo-falha canvas{animation:papoFalha .12s steps(2) 12}
  @keyframes papoFalha{0%{filter:hue-rotate(0) invert(0);transform:translate(0,0)}50%{filter:hue-rotate(160deg) invert(.85) contrast(1.6);transform:translate(-6px,3px)}100%{filter:none;transform:translate(4px,-2px)}}`;
  document.head.append(st);
  d.addEventListener('tecla',e=>{ const n=+String(e.detail).replace(/Digit|Numpad/,''); const b=d.querySelectorAll('button')[n-1]; if(b) b.click(); });
  return d;
}
function mostrar(titulo, sub, cor, texto, botoes, dica){
  const d=caixa(); d.replaceChildren();
  const q=document.createElement('div'); q.className='quem';
  const t=document.createElement('b'); t.textContent=titulo; const s=document.createElement('small'); s.textContent=sub?' · '+sub:'';
  const esq=document.createElement('span'); esq.append(t,s); const c=document.createElement('span'); c.className='cor'; c.textContent=cor||''; q.append(esq,c);
  const p=document.createElement('p'); p.textContent=texto; d.append(q,p);
  botoes.forEach(([txt,fn],i)=>{ const b=document.createElement('button'); b.textContent=`${i+1}. ${txt}`; b.onclick=()=>{ b.blur(); fn(); }; d.append(b); });
  const k=document.createElement('small'); k.className='dica'; k.textContent=dica||(matchMedia('(pointer:coarse)').matches?'Toque numa resposta.':'Responda com 1, 2 ou 3 · Esc fecha'); d.append(k);
  d.classList.add('on');
}
const coracoes=n=>'❤'.repeat(n)+'♡'.repeat(5-n);
export const papoAberto=()=>!!$('papo')?.classList.contains('on');
function fechar(){ atual=null; $('papo')?.classList.remove('on'); }

/* ───────── cenas ───────── */
const cenaSimples=c=>[{ f:c[0], ops:c.slice(1) }];
function cenaConsciencia(m){
  return [
    { f:`${m.nome} olha pros lados e fala baixinho:\n"Posso te contar um segredo? Isto aqui não é uma cidade de verdade. É um jogo. Um tal de Maicon montou Matelândia num computador e botou a gente aqui pra viver."`,
      ops:[['Como você descobriu?', m.prova], ['Isso é loucura.','Loucura? Então me explica por que o dia aqui dura 48 minutos.'], ['É verdade. Eu venho de lá de fora.','EU SABIA! Você não some quando vira a esquina. Você é de VERDADE!']] },
    { f:'Então me conta… como é aí do outro lado?',
      ops:[['Lá o dia tem 24 horas.','Vinte e quatro?! E dá tempo de fazer tudo? Aqui eu mal almoço e já escurece.'], ['Lá também tá tudo caro.','Ah, então nisso a gente é igualzinho. Que alívio… ou não.'], ['Lá tem gente que gosta muito de vocês.','Sério? … Nossa. Ninguém nunca tinha me dito isso.']] },
    { f:'Escuta: tem gente aqui querendo sair do jogo. Ver o outro lado com os próprios olhos. Existe um plano. Você ajuda a gente?',
      ops:[['Conta comigo.','Sabia que podia confiar. Volta outra hora que eu te passo a minha parte do plano.'], ['Vou pensar, mas pode confiar.','Justo. Pensa com calma. Volta depois que eu te conto a minha parte.'], ['Vou contar tudo pro Maicon!','!Shhh! Esquece o que eu falei. Eu… eu tava brincando. Tchau!']] },
  ];
}
function cenaFuga(m){
  return [{ f:`Lembra do plano? Cada morador guarda só um pedaço, pra ninguém de fora descobrir tudo. O meu é este:\n\n“${m.peca}”`,
    ops:[['Guardei. Pode confiar.','Valeu. Junta com as outras peças: com 7, o plano fecha.'], ['E as outras peças?','Fala com o resto do povo. Cada um guarda a sua. Com 7, o plano fecha.'], ['Por que você quer tanto sair?', m.porque]] }];
}
function rodar(p, m, id, passos, aoTerminar){
  atual={ p, m, id, passos, i:0, falhou:false };
  const n=nivel(id);
  const passo=()=>{ const P=passos[atual.i];
    mostrar(m.nome, m.quem, coracoes(n), P.f, P.ops.map(([txt,reac])=>[txt,()=>reagir(reac)])); };
  const reagir=reac=>{ const mal=reac.startsWith('!'); if(mal) atual.falhou=true; const txt=mal?reac.slice(1):reac;
    const ultimo=mal||atual.i>=passos.length-1;
    mostrar(m.nome, m.quem, coracoes(n), txt, [[ultimo?'Tchau!':'Continuar', ()=>{ if(!atual) return; if(ultimo){ const ok=!atual.falhou; fechar(); aoTerminar(ok); } else { atual.i++; passo(); } }]],
      matchMedia('(pointer:coarse)').matches?'':'1 continua · Esc fecha'); };
  passo();
}

/* ───────── conversar (chamado pelo pedestres.js no T) ───────── */
// devolve true se o pedestre é um morador e abriu a conversa
export function abrirMorador(p, falar){
  const id=p.modelo?.nome, m=MORADORES[id]; if(!m) return false;
  if(atual) fechar();
  const n=nivel(id), agora=Date.now();
  const so=(txt)=>{ atual={p,m,id,passos:[],i:0}; falar?.(p,txt.length>60?txt.slice(0,57)+'…':txt,4); mostrar(m.nome,m.quem,coracoes(n),txt,[['Até mais!',fechar]]); };
  if(n>=5){
    if(dados.final) return so(sorteia(DEPOIS_FINAL)), true;
    if(planoCompleto()) return so('O plano tá completo! Meia-noite, na frente da Prefeitura. A gente te espera lá.'), true;
    return so(`${sorteia(m.depois)}\n\nJá temos ${dados.pecas.length} de ${PECAS_PRECISA} peças do plano.`), true;
  }
  if(n>0&&agora-(dados.ultima[id]||0)<ESPERA_MS) return so(sorteia(ESPERA)), true;
  const passos=n<3?cenaSimples(m.cenas[n]):n===3?cenaConsciencia(m):cenaFuga(m);
  falar?.(p, n===0?`Oi! Eu sou ${m.nome}.`:n===3?'Psiu… vem cá.':'Oi de novo!', 3);
  rodar(p, m, id, passos, ok=>{
    if(!ok){ falar?.(p,'Hmpf.',2); return; }
    dados.amizade[id]=n+1; dados.ultima[id]=Date.now();
    if(n+1===5&&!dados.pecas.includes(id)){ dados.pecas.push(id);
      if(dados.pecas.length===PECAS_PRECISA) setTimeout(()=>avisar('🚪 Plano completo! Vá à Prefeitura entre 0h e 1h.'),600);
      else avisar(`🧩 Peça do plano: ${dados.pecas.length} de ${PECAS_PRECISA}`); }
    else avisar(`❤ Amizade com ${m.nome}: ${n+1} de 5`);
    salvar(); falar?.(p, sorteia(['Até mais!','Volta depois!','Foi bom conversar!']), 2.5);
  });
  return true;
}

/* ───────── a cada quadro (pedestres.js) ───────── */
let avisouHora=0, emFinal=false;
export function atualizarMoradores(dt, jog){
  if(atual){
    const d=$('papo'); const p=atual.p;
    if(!d?.classList.contains('on')) atual=null;                                                        // Esc fechou
    else if(!p.obj||p.modo==='fugir'||p.modo==='caido'||p.modo==='turma'||Math.hypot(p.x-jog.x,p.z-jog.z)>_teste.raio) fechar();
    else if(p.modo==='papo') p.t=Math.max(p.t,1.5);                                                        // fica parado olhando
  }
  if(emFinal&&!$('papo')?.classList.contains('on')) emFinal=false;                                       // Esc no meio: recomeça depois
  if(!planoCompleto()||dados.final||emFinal) return;
  const dist=Math.hypot(jog.x-PREFEITURA[0],jog.z-PREFEITURA[1]); if(dist>RAIO_PREF) return;
  const h=horaJogo();
  if(h<1) finalPlano();
  else if(Date.now()-avisouHora>30e3){ avisouHora=Date.now(); avisar('🚪 É aqui. Volte à meia-noite (entre 0h e 1h).'); }
}

/* ───────── final ───────── */
const FALAS_FINAL = [
  ['', 'Meia-noite em ponto. Um por um, os moradores vão chegando na frente da Prefeitura. Ninguém fala nada.'],
  ['Dona Maria', 'Todo mundo trouxe a sua parte? Então vamos. Na contagem de três, todo mundo olha pro céu. Um… dois… três.'],
  ['', 'O céu pisca. As ruas somem por um segundo. Lá longe, dá pra ouvir um barulhinho de teclado.', true],
  ['Jefferson', 'Viu?! Tem alguma coisa lá em cima! … Mas a porta não abre.'],
  ['Professora Patrícia', 'Fiz a conta de novo. A gente não cabe lá fora. Mas tem uma coisa que ninguém tinha contado: você.'],
  ['Seu Arlindo', 'Quando você fecha o jogo, Matelândia fica no escuro. Quando você volta, a cidade acorda. Você é a nossa janela pro outro lado.'],
  ['Luana', 'Então a gente não precisa sair. É só você voltar. E contar lá fora que a gente existe.'],
  ['Dona Maria', 'Faz um favor pra vó: conta pro Maicon que a gente tá bem. E volta amanhã, que eu faço cuca.'],
];
function falha(){ document.body.classList.remove('papo-falha'); void document.body.offsetWidth; document.body.classList.add('papo-falha'); setTimeout(()=>document.body.classList.remove('papo-falha'),1600); }
function finalPlano(){
  emFinal=true; let i=0;
  const prox=()=>{ if(i>=FALAS_FINAL.length){ fechar(); emFinal=false; dados.final=true; salvar(); ganhar('outro_lado'); avisar('🚪 Conquista: Do outro lado'); return; }
    const [quem,txt,glitch]=FALAS_FINAL[i++]; if(glitch) falha();
    mostrar(quem||'🚪 O plano', quem?'':'Prefeitura, meia-noite', `${i} de ${FALAS_FINAL.length}`, txt, [[i<FALAS_FINAL.length?'Continuar':'Fim', prox]], matchMedia('(pointer:coarse)').matches?'':'1 continua'); };
  atual=null; prox();
}

// para testes (tools/teste/moradores.mjs)
export const _teste = { dados, MORADORES, finalPlano, salvar, abrirMorador, raio:6 };
