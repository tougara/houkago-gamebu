/* Original conditional fictional life events.
 * Frequency, costs, outcomes are gameplay balance, not historical observation.
 * Historical news remains in data/historical-events.jp.json with source links.
 */
const option=(id,label,delta,result,rest={})=>({id,label,delta,result,...rest});
export function selectLifeEvent(s,random){
 if(s.age<16||s.age%6===0||s.phase!=='living')return null;
 const chance=s.money?.debt>=20?.40:.28;
 if(random()>=chance)return null;
 const job=s.career?.jobId||'dependent';
 const close=(s.people||[]).filter(p=>p.alive&&p.closeness>=45);
 const person=close.length?close[Math.floor(random()*close.length)]:null;
 const cards=[
  {id:'supplies',type:'money',weight:2,valid:()=>true,title:'暮らしの道具が壊れた',
   text:'使い慣れた暮らしの道具が使えなくなった。直すか、代わりを探すか、しばらく我慢するか。',
   choices:[
    option('repair','出費して直す',{wealth:-7,knowledge:2},'道具を直して、また使えるようになった。'),
    option('make','自分で工夫してみる',{wealth:-2,knowledge:5,health:-2},'手を動かし、なんとか使える形にした。'),
    option('wait','しばらく我慢する',{wealth:2,joy:-5},'無理を重ねながら、今あるものを使った。')]},
  {id:'illness',type:'health',weight:2,valid:()=>s.stats.health<80,title:'体調がすぐれない',
   text:'いつものように動けず、休養が必要に感じる。働き続けるか、暮らしを調整するか。',
   choices:[
    option('rest','仕事を減らして休む',{health:9,wealth:-7},'十分に休み、少し体調を取り戻した。'),
    option('care','身近な人に助けを求める',{health:6,bonds:5,wealth:-4},'周囲の助けを借りて療養した。'),
    option('push','無理をして働き続ける',{health:-7,wealth:6,joy:-3},'収入を守ろうとしたが、体には負担が残った。')]},
  {id:'opportunity',type:'career',weight:2,valid:()=>s.age>=16&&s.career?.jobId!=='dependent',title:'思いがけない仕事の話',
   text:'取引や手伝いの話が舞い込んだ。うまくいくかどうかは分からない。',
   choices:[
    option('try','新しい仕事に挑む',{knowledge:4,wealth:9,health:-2},'努力が実り、暮らしに余裕が生まれた。',{success:.62,failDelta:{wealth:-6,joy:-4},failResult:'思うような成果は得られず、出費だけが残った。'}),
    option('negotiate','話をよく聞き条件を整える',{knowledge:5,bonds:3},'相手と話し合い、次の機会のための学びを得た。'),
    option('decline','今の仕事を守る',{health:3,joy:1},'新しい話は見送り、今ある仕事を大切にした。')]},
  {id:'shortage',type:'money',weight:4,valid:()=>s.money?.debt>=12||s.stats.wealth<=32,title:'暮らしが苦しい',
   text:'貯えに余裕がなく、先の暮らしが心配になってきた。どこから立て直そうか。',
   choices:[
    option('extra','できる仕事を探す',{wealth:7,health:-5,knowledge:2},'体を動かし、少しだけ家計を支えた。'),
    option('ask','助けを求める',{bonds:4,wealth:3,joy:-1},'周囲の好意に支えられた。'),
    option('save','支出を見直す',{wealth:4,joy:-4},'楽しみを控え、当面の暮らしを守った。')]},
  {id:'teacher',type:'learning',weight:2,valid:()=>s.stats.knowledge<82,title:'知識を学ぶ機会',
   text:'新しい知恵や技能に触れる機会ができた。学びは将来の道を広げるかもしれない。',
   choices:[
    option('study','費用をかけて学ぶ',{knowledge:9,wealth:-7},'知識を得て、今まで見えなかった可能性に気づいた。'),
    option('observe','話だけ聞いて覚える',{knowledge:4,bonds:2},'教わったことを暮らしに生かせそうだ。'),
    option('pass','今の暮らしを優先する',{health:2,joy:2},'落ち着いた毎日を守ることにした。')]},
  {id:'family-time',type:'relationship',weight:2,valid:()=>!!person,title:person?person.name+'からの誘い':'大切な人からの誘い',
   text:person?person.name+'が、一緒に時間を過ごそうと声をかけてきた。仕事も気になるが、どうする？':'大切な人から声をかけられた。',
   choices:[
    option('join','一緒に時間を過ごす',{bonds:7,joy:5,wealth:-3},'ともに過ごした時間が、良い思い出になった。',{personId:person?.id,closeness:7}),
    option('talk','短い時間だけ話す',{bonds:4,knowledge:1},'忙しい中でも相手の話に耳を傾けた。',{personId:person?.id,closeness:4}),
    option('work','仕事を優先する',{wealth:5,bonds:-3},'仕事を片づけた。相手には少し寂しい思いをさせたかもしれない。',{personId:person?.id,closeness:-6})]},
  {id:'child',type:'relationship',weight:3,valid:()=>s.family.children>0,title:'子どもの将来',
   text:'家族の子どもが、これからの暮らしや学びについて話しかけてきた。',
   choices:[
    option('teach','一緒に学ぶ',{knowledge:3,bonds:7,wealth:-3},'自分の経験を伝えながら、一緒に考えた。'),
    option('support','家計から助ける',{wealth:-7,bonds:8,joy:3},'暮らしに負担はあったが、家族を支えられた。'),
    option('independent','自分で考えるよう促す',{bonds:2,knowledge:3,joy:-1},'子ども自身が決めることを大切にした。')]},
  {id:'harvest',type:'career',weight:3,valid:()=>job==='farm',title:'収穫の見通し',
   text:'田畑の様子が例年と少し違う。どこまで備え、どこまで挑戦するか。',
   choices:[
    option('reserve','蓄えを優先する',{wealth:3,health:2},'堅実に備え、食卓を守ろうとした。'),
    option('try','収穫の増加を目指す',{wealth:12,health:-4},'工夫が実り、収入につながった。',{success:.56,failDelta:{wealth:-7,health:-3},failResult:'思うほどの収穫にはならず、負担が残った。'}),
    option('learn','育て方を学び直す',{knowledge:6,wealth:-3},'次の年に向けて技術を見直した。')]},
  {id:'customers',type:'career',weight:3,valid:()=>job==='merchant',title:'常連客との縁',
   text:'これまでの商いの中で、客から相談を受けた。信頼を深めるか、利益を優先するか。',
   choices:[
    option('fair','公平な取引を心がける',{wealth:3,bonds:5},'相手は納得し、商いの縁が続いた。'),
    option('profit','今の利益を優先する',{wealth:10,bonds:-3},'収入は増えたが、人とのつながりは少し変わった。'),
    option('help','困りごとを解決する',{wealth:-3,bonds:8,knowledge:3},'誠実な対応が、信頼につながった。')]},
  {id:'craft',type:'career',weight:3,valid:()=>job==='craft',title:'難しい注文',
   text:'いつもより複雑な仕事を頼まれた。これまでの技術を試す機会だ。',
   choices:[
    option('accept','引き受けて取り組む',{knowledge:6,wealth:10,health:-2},'技を発揮し、仕事をやり遂げた。',{success:.58,failDelta:{knowledge:3,wealth:-4,health:-2},failResult:'仕事は難航したが、新しい知恵は残った。'}),
    option('consult','経験のある人に相談する',{knowledge:5,bonds:3},'相談を通して、仕事の幅が広がった。'),
    option('decline','無理な注文は断る',{health:2,joy:1},'今の仕事を守り、無理をしない道を選んだ。')]},
  {id:'neighbor',type:'relationship',weight:2,valid:()=>true,title:'近所で起きた小さな出来事',
   text:'近所の人が困っている。自分の生活にも余裕はないが、助けるか迷っている。',
   choices:[
    option('help','自分にできる範囲で助ける',{bonds:6,wealth:-3,joy:2},'手を差し伸べると、相手から感謝された。'),
    option('organize','周囲と協力する',{bonds:4,knowledge:3},'一人ではできないことも、協力すると進んだ。'),
    option('leave','関わらず暮らしを守る',{health:2,joy:-2},'自分の暮らしを守ることにした。')]},
  {id:'season',type:'health',weight:1,valid:()=>true,title:'季節の変わり目',
   text:'季節が変わり、体調や仕事の調整が必要になった。毎日の小さな選択も暮らしを変える。',
   choices:[
    option('rest','しっかり休む',{health:6,wealth:-4},'体を休めた。'),
    option('prepare','次の季節に備える',{knowledge:2,wealth:-3,health:3},'少し余裕を持って準備できた。'),
    option('push','いつもどおり働く',{wealth:5,health:-3},'いつもの仕事を続けた。')]}
 ];
 const available=cards.filter(c=>c.valid());
 const total=available.reduce((sum,c)=>sum+c.weight,0);
 let roll=random()*total;
 return available.find(c=>(roll-=c.weight)<0)||available.at(-1);
}
