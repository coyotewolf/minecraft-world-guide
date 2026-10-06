// Inventory artwork is extracted from this pack's item models and textures.
export const STATION_ITEMS={
 'sophisticatedbackpacks:backpack_upgrade':'minecraft:crafting_table','sophisticatedbackpacks:smithing_backpack_upgrade':'minecraft:smithing_table','farmersdelight:cooking':'farmersdelight:cooking_pot','farmersdelight:cutting':'farmersdelight:cutting_board','ae2:inscriber':'ae2:inscriber',
 'minecraft:crafting_shaped':'minecraft:crafting_table','minecraft:crafting_shapeless':'minecraft:crafting_table','sophisticatedbackpacks:basic_backpack':'minecraft:crafting_table','framedblocks:frame':'minecraft:crafting_table','enderstorage:create_recipe':'minecraft:crafting_table','enderstorage:recolour_recipe':'minecraft:crafting_table',
 'minecraft:smelting':'minecraft:furnace','minecraft:blasting':'minecraft:blast_furnace','minecraft:smoking':'minecraft:smoker','minecraft:stonecutting':'minecraft:stonecutter','minecraft:smithing_transform':'minecraft:smithing_table',
 'create:pressing':'create:mechanical_press','create:mixing':'create:mechanical_mixer','create:mechanical_crafting':'create:mechanical_crafter','create_jetpack:copy_nbt_mechanical_crafting':'create:mechanical_crafter','create:cutting':'create:mechanical_saw','create:deploying':'create:deployer','create:filling':'create:spout','createmetallurgy:casting_in_table':'createmetallurgy:casting_table'
};
export function createRecipeView({h,image,nameOf,tagName,stationName,heatName,tags,icons}){
 function ingredientText(v){if(typeof v==='string')return nameOf(v);if(Array.isArray(v))return v.map(ingredientText).join(' 或 ');if(v?.tag)return tagName(v.tag);if(v?.fluid)return ({'minecraft:water':'水','minecraft:lava':'熔岩'}[v.fluid]||nameOf(v.fluid))+(v.amount?' '+v.amount+' mB':'');if(v?.item)return nameOf(v.item);return '指定材料'}
 function ingredientView(v,{slot=false,output=false}={}){
  if(!v)return '<span class="recipe-slot recipe-empty" aria-label="空格"></span>';
  if(Array.isArray(v))return `<div class="recipe-options">${v.map(x=>ingredientView(x,{slot,output})).join('<span class="ingredient-or">或</span>')}</div>`;
  if(typeof v==='string')v={item:v};
  const id=v.item||v.fluid||(v.tag?(tags[v.tag]||[]).find(id=>icons[id]):null),label=ingredientText(v),count=v.count||1,cls=slot?'recipe-slot':'recipe-material';
  const action=v.tag?`data-material-tag="${h(v.tag)}"`:v.item?`data-recipe="${h(v.item)}"`:'';
  const inside=`${id?image(id):''}${count>1?`<span class="ingredient-count">${h(count)}</span>`:''}<span class="ingredient-name ${icons[id]?'inventory-label':''}">${h(label)}</span>${v.fluid&&v.amount?`<span class="ingredient-volume">${h(v.amount)} mB</span>`:''}${v.tag?'<span class="ingredient-alternative" aria-hidden="true">↻</span>':''}${output&&v.chance!=null&&v.chance<1?`<span class="ingredient-chance">${Math.round(v.chance*100)}%</span>`:''}`;
  return action?`<button type="button" class="${cls}${output?' recipe-output':''}" ${action} data-item-hint="${h(label)}${v.tag?'（任一適用材料）':''}" aria-label="${h(label)}${count>1?' × '+count:''}${v.tag?'，查看可用材料':''}">${inside}</button>`:`<span class="${cls}" ${id?`data-item-hint="${h(label)}" tabindex="0" aria-label="${h(label)}"`:''}>${inside}</span>`;
 }
 function stationView(type){const id=STATION_ITEMS[type],labels={'minecraft:crafting_shaped':'合成台・依格位放置','minecraft:crafting_shapeless':'合成台・不限制格位放置','create:sequenced_assembly':'序列組裝'};const label=labels[type]||(id==='minecraft:crafting_table'?'合成台':id?nameOf(id):stationName(type));return `<div class="recipe-station" ${id?`data-item-hint="${h(label)}" tabindex="0" aria-label="${h(label)}"`:""}>${id?image(id):''}<span>${h(label)}</span></div>`}
 function renderRecipe(r){
  if(r.type==='forge:conditional')return (r.recipes||[]).map(x=>renderRecipe(x.recipe)).join('');
  let body='';
  if(r.template||r.base||r.addition)body=`<div class="recipe-materials">${[r.template,r.base,r.addition].filter(Boolean).map(x=>ingredientView(x)).join('')}</div>`;
  if(r.pattern){const cols=Math.max(3,...r.pattern.map(row=>row.length)),rows=Math.max(3,r.pattern.length);body=`<div class="recipe-grid-scroll"><div class="recipe-game-grid" style="--recipe-cols:${cols}">${Array.from({length:cols*rows},(_,i)=>{const c=r.pattern[Math.floor(i/cols)]?.[i%cols];return ingredientView(c&&c!==' '?r.key?.[c]:null,{slot:true})}).join('')}</div></div>`}
  else if(r.ingredients){const shaped=r.type==='minecraft:crafting_shapeless';body=shaped?`<div class="recipe-game-grid" style="--recipe-cols:3">${Array.from({length:Math.max(9,r.ingredients.length)},(_,i)=>ingredientView(r.ingredients[i],{slot:true})).join('')}</div>`:`<div class="recipe-materials">${r.ingredients.map(x=>ingredientView(x)).join('')}</div>`}
  else if(r.ingredient)body=`<div class="recipe-materials">${ingredientView(r.ingredient)}</div>`;
  if(r.tool)body+=`<p>工具</p><div class="recipe-materials">${ingredientView(r.tool)}</div>`;
  if(r.sequence)body+=`<ol class="recipe-sequence">${r.sequence.map(s=>`<li>${stationView(s.type)}<div class="recipe-materials">${(s.ingredients||[]).map(x=>ingredientView(x)).join('')}</div></li>`).join('')}</ol>`;
  const results=r.results||[r.result].filter(Boolean);
  return `<section class="panel game-recipe">${stationView(r.type)}${body}${r.heatRequirement&&r.heatRequirement!=='none'?`<p class="recipe-heat">${image('create:blaze_burner')}${h(heatName(r.heatRequirement))}</p>`:''}${r.loops?`<p>重複 ${h(r.loops)} 次</p>`:''}<div class="recipe-results"><span aria-hidden="true">→</span>${results.map(x=>ingredientView(x,{output:true})).join('')}</div></section>`;
 }
 return {renderRecipe,ingredientView};
}
