package io.github.coyotewolf.aoi.update;
import com.google.gson.*;
import java.net.URI;
import java.security.*;
import java.security.spec.X509EncodedKeySpec;
import java.time.Instant;
import java.util.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.zip.ZipFile;
public record ReleaseManifest(String version,URI url,String sha256,long bytes) {
 public static final String FEED="https://coyotewolf.github.io/minecraft-world-guide/downloads/aoi-assistant-latest.json";
 public static final String PUBLIC_KEY="MCowBQYDK2VwAyEAPst1u2K9Kq65tPnb+8yNziHhymHeK6GDXnxkP4xHt7c=";
 public static int compare(String a,String b){int[] left=version(a),right=version(b);for(int i=0;i<3;i++){int c=Integer.compare(left[i],right[i]);if(c!=0)return c;}return 0;}
 private static int[] version(String value){if(value==null||!value.matches("(?:0|[1-9][0-9]{0,5})\\.(?:0|[1-9][0-9]{0,5})\\.(?:0|[1-9][0-9]{0,5})"))throw new IllegalArgumentException("version");return Arrays.stream(value.split("\\.")).mapToInt(Integer::parseInt).toArray();}
 public static ReleaseManifest verify(String raw,String running,Instant now,String publicKey)throws Exception{
  if(raw.getBytes(StandardCharsets.UTF_8).length>16384)throw new IllegalArgumentException("manifest size");
  var envelope=JsonParser.parseString(raw).getAsJsonObject();byte[] payload=Base64.getDecoder().decode(envelope.get("payload").getAsString()),sig=Base64.getDecoder().decode(envelope.get("signature").getAsString());if(payload.length>8192||sig.length!=64)throw new IllegalArgumentException("envelope");
  var key=KeyFactory.getInstance("Ed25519").generatePublic(new X509EncodedKeySpec(Base64.getDecoder().decode(publicKey)));var verifier=Signature.getInstance("Ed25519");verifier.initVerify(key);verifier.update(payload);if(!verifier.verify(sig))throw new SecurityException("release signature");
  var m=JsonParser.parseString(new String(payload,StandardCharsets.UTF_8)).getAsJsonObject();
  if(m.get("protocol").getAsInt()!=1||!m.get("modId").getAsString().equals("aoi_assistant")||!m.get("minecraft").getAsString().equals("1.20.1")||!m.get("loader").getAsString().equals("forge")||!m.get("channel").getAsString().equals("stable"))throw new IllegalArgumentException("compatibility");
  String v=m.get("version").getAsString();version(v);version(running);var published=Instant.parse(m.get("publishedAt").getAsString());var expires=Instant.parse(m.get("expiresAt").getAsString());if(published.isAfter(now.plusSeconds(86400))||!expires.isAfter(now)||!expires.isAfter(published))throw new SecurityException("manifest validity");
  URI url=URI.create(m.get("url").getAsString());if(!url.toString().equals("https://coyotewolf.github.io/minecraft-world-guide/downloads/aoi-ai-assistant-1.20.1-"+v+".jar"))throw new SecurityException("release URL");
  String hash=m.get("sha256").getAsString();long length=m.get("bytes").getAsLong();if(!hash.matches("[a-f0-9]{64}")||length<10000||length>16777216)throw new IllegalArgumentException("artifact");
  return new ReleaseManifest(v,url,hash,length);
 }
 public static String hash(Path file)throws Exception{var digest=MessageDigest.getInstance("SHA-256");try(var in=Files.newInputStream(file)){byte[] buffer=new byte[32768];for(int n;(n=in.read(buffer))!=-1;)digest.update(buffer,0,n);}return HexFormat.of().formatHex(digest.digest());}
 public void verifyJar(Path file)throws Exception{
  if(Files.size(file)!=bytes||!hash(file).equals(sha256))throw new SecurityException("artifact hash");
  try(var zip=new ZipFile(file.toFile())){var entry=zip.getEntry("META-INF/mods.toml");if(entry==null||entry.getSize()>65536||entry.getSize()<0||zip.getEntry("io/github/coyotewolf/aoi/AoiAssistantMod.class")==null)throw new SecurityException("mod metadata");
   try(var in=zip.getInputStream(entry)){String toml=new String(in.readNBytes(65537),StandardCharsets.UTF_8);if(toml.length()>65536||!toml.matches("(?s).*modId\\s*=\\s*\"aoi_assistant\".*")||!toml.matches("(?s).*version\\s*=\\s*\""+java.util.regex.Pattern.quote(version)+"\".*"))throw new SecurityException("mod version");}
  }
 }
}
