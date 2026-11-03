package io.github.coyotewolf.aoi.client;

import com.google.gson.*;
import io.github.coyotewolf.aoi.model.Models;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.ChatScreen;
import net.minecraft.client.gui.screens.inventory.AbstractContainerScreen;
import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.enchantment.EnchantmentHelper;
import net.minecraft.world.entity.*;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.entity.item.ItemEntity;
import net.minecraft.world.level.ClipContext;
import net.minecraft.world.phys.*;
import net.minecraftforge.client.event.RenderLevelStageEvent;
import net.minecraftforge.registries.ForgeRegistries;
import java.util.*;

/** Read client-synchronized data only; never open containers or inspect hidden NBT. */
public final class GameScene {
 private static final WeakHashMap<Screen,JsonObject> snapshots=new WeakHashMap<>();
 private static JsonObject chat=new JsonObject();
 private static ClientLevel world,renderWorld;
 private static JsonArray visible=new JsonArray();
 private static long renderedAt;
 private static Vec3 renderLook,renderEye;
 private static int omittedEntities;
 public static JsonObject item(ItemStack stack){
  if(stack==null||stack.isEmpty())return null;
  var id=ForgeRegistries.ITEMS.getKey(stack.getItem());if(id==null)return null;
  var row=Models.obj("id",id.toString(),"name",Models.safe(stack.getHoverName().getString(),48),"count",stack.getCount());
  if(stack.isDamageableItem()){row.addProperty("damage",stack.getDamageValue());row.addProperty("maxDamage",stack.getMaxDamage());}
  var enchants=new JsonObject();EnchantmentHelper.getEnchantments(stack).forEach((enchantment,level)->{var key=ForgeRegistries.ENCHANTMENTS.getKey(enchantment);if(key!=null)enchants.addProperty(key.toString(),level);});
  if(enchants.size()>0)row.add("enchantments",enchants);return row;
 }
 private static void add(JsonArray array,ItemStack stack){var row=item(stack);if(row!=null)array.add(row);}
 public static JsonObject capture(Screen previous){
  var mc=Minecraft.getInstance();var result=new JsonObject();if(mc.player==null||mc.level==null)return result;
  result.addProperty("version",1);var target=CrosshairTarget.capture();
  if(target!=null)result.add("target",Models.obj("kind",target.kind(),"id",target.id(),"name",target.name()));
  var hands=new JsonObject();var main=item(mc.player.getMainHandItem());var off=item(mc.player.getOffhandItem());
  if(main!=null)hands.add("main",main);if(off!=null)hands.add("off",off);result.add("hands",hands);
  var inventory=new JsonArray();mc.player.getInventory().items.forEach(s->add(inventory,s));result.add("inventory",inventory);
  var armor=new JsonArray();mc.player.getInventory().armor.forEach(s->add(armor,s));result.add("armor",armor);
  if(previous instanceof AbstractContainerScreen<?> screen){
   var slots=new JsonArray();int omitted=0;
   for(var slot:screen.getMenu().slots)if(slot.container!=mc.player.getInventory()&&slot.hasItem()){
    if(slots.size()<256){var row=item(slot.getItem());if(row!=null){row.addProperty("slot",slot.index);slots.add(row);}}else omitted++;
   }
   result.add("container",Models.obj("name",Models.safe(previous.getTitle().getString(),48),"items",slots,"omitted",omitted));
  }
  var jei=jei();if(jei.size()>0)result.add("jei",jei);
  var camera=mc.gameRenderer.getMainCamera();var vector=camera.getLookVector();var currentLook=new Vec3(vector.x(),vector.y(),vector.z());
  if(renderWorld==mc.level&&System.currentTimeMillis()-renderedAt<1500&&renderLook!=null&&currentLook.dot(renderLook)>.995&&camera.getPosition().distanceToSqr(renderEye)<.09){result.add("entities",visible.deepCopy());result.addProperty("entitiesOmitted",omittedEntities);}
  else {result.add("entities",new JsonArray());result.addProperty("viewStatus","尚未取得近期視野；不代表附近沒有生物");}
  // Preserve inventory/container first, then trim exceptionally large JEI pages explicitly.
  while(result.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8).length>64000&&jei.has("items")&&jei.getAsJsonArray("items").size()>0){
   var items=jei.getAsJsonArray("items");items.remove(items.size()-1);jei.addProperty("omitted",jei.get("omitted").getAsInt()+1);
  }
  return result;
 }
 public static JsonObject jei(){
  var data=new JsonObject();if(!net.minecraftforge.fml.ModList.get().isLoaded("jei"))return data;
  try{
   // Optional compatibility with installed JEI 15: runtime access, public overlay API.
   Object runtime=Class.forName("mezz.jei.common.Internal").getMethod("getJeiRuntime").invoke(null);
   Object overlay=Class.forName("mezz.jei.api.runtime.IJeiRuntime").getMethod("getIngredientListOverlay").invoke(runtime);
   Class<?> api=Class.forName("mezz.jei.api.runtime.IIngredientListOverlay");
   boolean displayed=Boolean.TRUE.equals(api.getMethod("isListDisplayed").invoke(overlay));
   var screen=Minecraft.getInstance().screen;boolean recipeScreen=screen!=null&&screen.getClass().getName().equals("mezz.jei.gui.recipes.RecipesGui");
   if(!displayed&&!recipeScreen)return data;
   Object type=Class.forName("mezz.jei.api.constants.VanillaTypes").getField("ITEM_STACK").get(null);
   var items=new JsonArray();int total=0;
   if(recipeScreen)try{
    var layoutsField=screen.getClass().getDeclaredField("layouts");layoutsField.setAccessible(true);Object layouts=layoutsField.get(screen);
    var rowsField=layouts.getClass().getDeclaredField("recipeLayoutsWithButtons");rowsField.setAccessible(true);
    Class<?> buttons=Class.forName("mezz.jei.gui.recipes.IRecipeLayoutWithButtons"),layoutApi=Class.forName("mezz.jei.api.gui.IRecipeLayoutDrawable"),slotsApi=Class.forName("mezz.jei.api.gui.ingredient.IRecipeSlotsView"),slotApi=Class.forName("mezz.jei.api.gui.ingredient.IRecipeSlotView");
    int recipeIndex=0;for(Object entry:(List<?>)rowsField.get(layouts)){
     Object layout=buttons.getMethod("getRecipeLayout").invoke(entry),slots=layoutApi.getMethod("getRecipeSlotsView").invoke(layout);
     for(Object slot:(List<?>)slotsApi.getMethod("getSlotViews").invoke(slots)){
      var displayedStack=(Optional<?>)slotApi.getMethod("getDisplayedItemStack").invoke(slot);
      if(displayedStack.isPresent()&&displayedStack.get() instanceof ItemStack stack){var row=item(stack);if(row!=null){total++;if(items.size()<256){row.addProperty("role",slotApi.getMethod("getRole").invoke(slot).toString());row.addProperty("recipeIndex",recipeIndex);items.add(row);}}}
     }recipeIndex++;
    }
   }catch(ReflectiveOperationException|RuntimeException e){data.addProperty("status","JEI 配方展示頁無法讀取；清單頁另行讀取");}
   if(displayed)for(Object entry:(List<?>)api.getMethod("getVisibleIngredients",Class.forName("mezz.jei.api.ingredients.IIngredientType")).invoke(overlay,type))if(entry instanceof ItemStack stack){var row=item(stack);if(row!=null){total++;if(items.size()<256){row.addProperty("role","LIST");items.add(row);}}}
   data.add("items",items);data.addProperty("omitted",Math.max(0,total-items.size()));data.addProperty("scope","JEI 目前清單和配方頁的物品圖示；旋轉材料只代表目前顯示的一種選項，不含流體或完整配方條件，也不代表玩家持有或能製作");
  }catch(ReflectiveOperationException|LinkageError|RuntimeException e){data.addProperty("status","JEI 相容介面無法讀取；不代表清單沒有物品");}
  return data;
 }
 public static void opening(Screen next,Screen previous){
  if(next instanceof ChatScreen){world=Minecraft.getInstance().level;chat=snapshots.computeIfAbsent(next,s->capture(previous));}
 }
 public static JsonObject withPlayerContext(JsonObject scene,Screen previous){var result=scene.deepCopy();try{result.add("playerContext",PlayerContext.capture(previous));}catch(RuntimeException|LinkageError e){var unavailable=new JsonArray();unavailable.add("新增玩家狀態讀取失敗；原本場景資料仍可使用，請補充所問狀態的介面讀數");result.add("playerContext",Models.obj("version",new JsonPrimitive(1),"unavailable",unavailable));}return result;}
 public static JsonObject current(){return world==Minecraft.getInstance().level?chat.deepCopy():new JsonObject();}
 public static String summary(){
  var scene=current();return "附帶：背包 "+size(scene,"inventory")+"、箱子/介面 "+nestedSize(scene,"container")+"、JEI "+nestedSize(scene,"jei")+"、可見生物/掉落物 "+size(scene,"entities")+"（開啟聊天時固定）";
 }
 private static int size(JsonObject row,String key){return row.has(key)&&row.get(key).isJsonArray()?row.getAsJsonArray(key).size():0;}
 private static int nestedSize(JsonObject row,String key){return row.has(key)&&row.get(key).isJsonObject()?size(row.getAsJsonObject(key),"items"):0;}
 public static void clear(){chat=new JsonObject();visible=new JsonArray();snapshots.clear();world=null;renderWorld=null;renderedAt=0;}
 public static void rendered(RenderLevelStageEvent event){
  if(event.getStage()!=RenderLevelStageEvent.Stage.AFTER_ENTITIES)return;
  var mc=Minecraft.getInstance();if(mc.level==null||mc.player==null||event.getFrustum()==null)return;
  long now=System.currentTimeMillis();
  var eye=event.getCamera().getPosition();var direction=event.getCamera().getLookVector();var look=new Vec3(direction.x(),direction.y(),direction.z());
  if(renderWorld==mc.level&&now-renderedAt<500&&renderLook!=null&&look.dot(renderLook)>.995&&eye.distanceToSqr(renderEye)<.09)return;
  var right=look.cross(new Vec3(0,1,0)).normalize();var candidates=new ArrayList<Entity>();
  for(var e:mc.level.entitiesForRendering())if(!(e instanceof Player)&&(e instanceof LivingEntity||e instanceof ItemEntity)&&!e.isRemoved()&&!e.isInvisibleTo(mc.player)&&e.distanceToSqr(eye)<96*96&&e.shouldRenderAtSqrDistance(e.distanceToSqr(eye))&&event.getFrustum().isVisible(e.getBoundingBox()))candidates.add(e);
  candidates.sort(Comparator.comparingDouble(e->e.distanceToSqr(eye)));var rows=new ArrayList<JsonObject>();
  for(var e:candidates){
   var box=e.getBoundingBox();var points=List.of(box.getCenter(),e.getEyePosition(),new Vec3(box.minX,box.maxY,box.minZ),new Vec3(box.maxX,box.maxY,box.maxZ),new Vec3(box.minX,box.minY,box.maxZ),new Vec3(box.maxX,box.minY,box.minZ));
   boolean clear=false;for(var point:points)if(mc.level.clip(new ClipContext(eye,point,ClipContext.Block.VISUAL,ClipContext.Fluid.NONE,mc.player)).getType()==HitResult.Type.MISS){clear=true;break;}
   if(!clear)continue;
   var id=ForgeRegistries.ENTITY_TYPES.getKey(e.getType());if(id==null)continue;
   var offset=box.getCenter().subtract(eye);double side=offset.normalize().dot(right);
   var row=Models.obj("id",id.toString(),"name",Models.safe(e.getType().getDescription().getString(),48),"distance",Math.round(offset.length()),"direction",side<-.25?"左側":side>.25?"右側":"中央");
   if(e instanceof ItemEntity drop){var stack=item(drop.getItem());if(stack!=null)row.add("item",stack);}
   if(e instanceof LivingEntity living)row.addProperty("baby",living.isBaby());
   if(e instanceof TamableAnimal tame)row.addProperty("tamed",tame.isTame());
   rows.add(row);
  }
  visible=io.github.coyotewolf.aoi.model.SceneSelection.choose(rows,32);omittedEntities=rows.size()-visible.size();renderWorld=mc.level;renderedAt=now;renderEye=eye;renderLook=look;
 }
 private GameScene(){}
}
