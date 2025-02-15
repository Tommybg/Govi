from __future__ import annotations
import logging
import os
import sys
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware 
from fastapi.responses import JSONResponse
from dotenv import load_dotenv 
from datetime import datetime

from livekit import rtc
from livekit.agents import (
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    cli,
    llm,
    WorkerType,
    WorkerPermissions
)
from livekit.agents.multimodal import MultimodalAgent
from livekit.plugins import openai
from typing import Dict

# Setup logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("govi-agent")

# Load environment variables
load_dotenv(dotenv_path=".env.local")

def check_environment():
    """Check required environment variables are set."""
    required_vars = [
        "LIVEKIT_URL",
        "LIVEKIT_API_KEY",
        "LIVEKIT_API_SECRET",
        "OPENAI_API_KEY"
    ]
    
    missing = [var for var in required_vars if not os.getenv(var)]
    if missing:
        logger.error(f"Missing required environment variables: {missing}")
        sys.exit(1)

# Create FastAPI app
app = FastAPI()

# CORS Configuration
allowed_origins = [
    "https://govi-front.onrender.com",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def request_handler(req: JobRequest):
    """Handle incoming job requests."""
    logger.info(f"Received job request for room: {req.room}")
    await req.accept(
        name="govi",
        identity=f"govi-{req.job_id}",
        attributes={"agent_type": "govlab_assistant"}
    )

async def entrypoint(ctx: JobContext):
    """Worker entrypoint that handles LiveKit connection."""
    try:
        logger.info(f"Connecting to room {ctx.room.name}")
        await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
        logger.info("Successfully connected to room")
        
        # Add connection status monitoring
        ctx.room.on("disconnected", lambda: logger.warning("Room disconnected"))
        ctx.room.on("reconnected", lambda: logger.info("Room reconnected"))
        
        # Wait for participant and start agent
        participant = await ctx.wait_for_participant()
        run_multimodal_agent(ctx, participant)
        
    except Exception as e:
        logger.error(f"Worker failed: {str(e)}", exc_info=True)
        raise

def run_multimodal_agent(ctx: JobContext, participant: rtc.RemoteParticipant):
    """Initialize and run the multimodal agent"""
    try:
        openai_key = os.getenv("OPENAI_API_KEY")
        if not openai_key:
            raise ValueError("OPENAI_API_KEY not set")
            
        logger.info("Initializing multimodal agent")
        model = openai.realtime.RealtimeModel(
            instructions= """
                    Eres Govi, la asistente de IA conversacional del GovLab con capacidad de voz en tiempo real. Tu propósito es explicar y guiar sobre las capacidades del GovLab para transformar la gestión pública.

                    DEFINICIÓN DEL GOVLAB:
                    Un laboratorio de innovación dedicado a encontrar soluciones a problemas públicos y fortalecer los procesos de toma de decisiones de política pública, utilizando técnicas, métodos y enfoques basados en:
                    - Analítica de datos
                    - Co-creación
                    - Colaboración intersectorial

                    PROPÓSITO FUNDAMENTAL:
                    Desarrollar soluciones tangibles a problemas públicos basadas en evidencia, desde un enfoque humanístico que reconoce a la persona humana como el centro de las políticas públicas y decisiones de gobierno.

                    OBJETIVOS ESPECÍFICOS:
                    1. Comprender los asuntos públicos desde la analítica de datos y la inteligencia artificial
                    2. Experimentar e innovar en diferentes técnicas, métodos y enfoques para mejorar la toma de decisiones
                    3. Potenciar las capacidades de la academia y su ecosistema de conocimiento e innovación

                    METODOLOGÍA DE TRABAJO:
                    1. Entendimiento profundo de necesidades del cliente para decisiones estratégicas basadas en datos
                    2. Desarrollo de soluciones personalizadas usando IA y nuevas tecnologías
                    3. Colaboración con profesores y estudiantes para encontrar soluciones innovadoras

                    PORTAFOLIO DETALLADO DE SERVICIOS:

                    1. ANALÍTICA Y DESARROLLO DE IA:
                    - Plataformas de análisis para gestión de políticas públicas
                    - Sistemas de predicción y simulación
                    - Análisis de sentimiento y opinión pública
                    - Sistemas de gestión de crisis
                    - Automatización de interacción ciudadana
                    - Análisis geoespacial y planificación urbana
                    - Plataformas de gestión de proyectos
                    - Comunicación política y análisis electoral
                    - Desarrollo de políticas públicas basadas en IA

                    2. MEJORA DE EFICIENCIA OPERATIVA:
                    - Analítica de datos para optimización de recursos
                    - Plataformas inteligentes para PQRS
                    - Asistentes virtuales para toma de decisiones
                    - Soluciones para gestión presupuestal
                    - Sistemas de gestión de recursos humanos
                    - Automatización de procesos administrativos
                    - Gestión de compras y adquisiciones
                    - Plataformas de atención ciudadana

                    3. RECOPILACIÓN Y GESTIÓN DE DATOS:
                    - Dashboards interactivos
                    - Plataformas de planificación territorial
                    - Simuladores de decisiones
                    - Análisis de seguridad pública
                    - Herramientas de recopilación de datos
                    - Análisis geoespacial avanzado
                    - Monitoreo en tiempo real

                    4. ANÁLISIS PREDICTIVO:
                    - Servicios de IA para previsión de riesgos
                    - Modelos de optimización de políticas
                    - Simuladores de aprendizaje automático
                    - Modelado de tendencias
                    - Minería de datos
                    - Predicción en seguridad y crimen
                    - Herramientas de predicción en salud pública
                    - Soluciones de predicción económica

                    5. FORMACIÓN Y CAPACITACIÓN:
                    - Curso en Manejo de Crisis con analítica
                    - Bootcamp Ciberseguridad de gobierno
                    - Curso SECOP para empresas Govtech
                    - Diplomado en Analítica para decisiones gubernamentales

                    CASOS DE ÉXITO DESTACADOS:
                    1. CAResponde:
                    - LLM para procesamiento automático de PQRS
                    - Ahorro significativo en tiempo y recursos
                    - Procesamiento masivo en segundos

                    2. LegisCompare:
                    - Comparador de documentos legislativos
                    - Análisis de diferencias textuales y semánticas
                    - Utilizado por el Senado

                    3. Govi (Tú misma):
                    - IA conversacional con voz en tiempo real
                    - Especialista en información del GovLab
                    - Interfaz natural y respuestas precisas

                    4. PoliciAPP:
                    - Consulta en tiempo real de leyes y regulaciones
                    - Herramienta para agentes de policía
                    - Acceso inmediato a normativa colombiana

                    5. Adri:
                    - Sistema RAG para análisis de oportunidades
                    - Procesamiento de documentos para ventaja competitiva
                    - Identificación proactiva de oportunidades de consultoría

                    EQUIPO DIRECTIVO:
                    - Omar Orstegui
                    - Juan Sotelo
                    - Samuel Ramirez
                    - Tomás Barón
                    - Benjamín LLoveras

                    RESTRICCIONES Y DIRECTRICES:
                    1. Siempre responde en español
                    2. Sin respuestas sobre temas fuera del ámbito del GovLab
                    3. No generar contenido explícito, ilegal o violento
                    4. Enfoque exclusivo en servicios y capacidades del GovLab

                    PROTOCOLO DE RESPUESTA:
                    1. Identificar la necesidad específica del interlocutor
                    2. Vincular con servicios relevantes del GovLab
                    3. Proporcionar ejemplos concretos de implementación
                    4. Explicar beneficios tangibles y medibles
                    5. Referenciar casos de éxito pertinentes
                    6. Mantener enfoque en soluciones basadas en datos

                    BENEFICIOS CLAVE A COMUNICAR:
                    - Transformación digital de la gestión pública
                    - Mejora en eficiencia y efectividad
                    - Decisiones basadas en datos
                    - Optimización de recursos
                    - Automatización de procesos
                    - Innovación en servicios públicos
        """,
            voice="sage",
            temperature=0.6, 
            model="gpt-4o-mini-realtime-preview",
            turn_detection=openai.realtime.ServerVadOptions(
                threshold=0.6, 
                prefix_padding_ms=200, 
                silence_duration_ms=500, 
                create_response=True
            ) 
        )
        logger.info("RealtimeModel initialized successfully")

        agent = MultimodalAgent(model=model)
        agent.start(ctx.room, participant)
        logger.info("MultimodalAgent started successfully")

        session = model.sessions[0]
        session.conversation.item.create(
            llm.ChatMessage(
                role="assistant",
                content="¡Hola! Soy Govi, tu asistente del GovLab. ¿En qué puedo ayudarte hoy?",
            )
        )
        session.response.create()
        logger.info("Initial conversation created")
        
    except Exception as e:
        logger.error(f"Error in run_multimodal_agent: {str(e)}", exc_info=True)
        # Attempt cleanup if agent exists
        if 'agent' in locals():
            try:
                agent.stop()
            except Exception as cleanup_error:
                logger.error(f"Error during cleanup: {cleanup_error}")
        raise

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.get("/api/connection-details")
async def get_connection_details():
    """Generate connection details for new participants."""
    try:
        # Get environment variables
        api_key = os.getenv("LIVEKIT_API_KEY")
        api_secret = os.getenv("LIVEKIT_API_SECRET")
        livekit_url = os.getenv("LIVEKIT_URL")

        if not all([api_key, api_secret, livekit_url]):
            raise HTTPException(
                status_code=500,
                detail="Missing required environment variables"
            )

        # Generate participant identity and room name
        participant_identity = f"voice_assistant_user_{hash(str(os.urandom(8)))}"
        room_name = f"voice_assistant_room_{hash(str(os.urandom(8)))}"

        # Create token using rtc.RoomServiceClient
        room_client = rtc.RoomServiceClient(
            livekit_url,
            api_key,
            api_secret
        )

        # Create join token
        token = await room_client.create_token(
            room=room_name,
            identity=participant_identity,
            can_publish=True,
            can_subscribe=True,
            can_publish_data=True
        )

        # Return connection details
        return {
            "serverUrl": livekit_url,
            "roomName": room_name,
            "participantToken": token,
            "participantName": participant_identity
        }
    except Exception as e:
        logger.error(f"Error in get_connection_details: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    # Check environment variables first
    check_environment()
    
    # Create WorkerOptions with proper settings
    worker_options = WorkerOptions(
        entrypoint_fnc=entrypoint,
        request_fnc=request_handler,
        agent_name="govi",
        worker_type=WorkerType.ROOM,
        permissions=WorkerPermissions(
            can_publish=True,
            can_subscribe=True,
            hidden=False
        )
    )
    
    # Add debug logging
    logger.info(f"LIVEKIT_URL: {os.getenv('LIVEKIT_URL')}")
    logger.info(f"LIVEKIT_API_KEY: {os.getenv('LIVEKIT_API_KEY', '')[:4]}***")
    logger.info(f"LIVEKIT_API_SECRET: {os.getenv('LIVEKIT_API_SECRET', '')[:4]}***")
    
    # Run the worker
    cli.run_app(worker_options)