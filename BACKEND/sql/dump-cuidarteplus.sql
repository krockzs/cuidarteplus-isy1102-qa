-- REEMPLAZO SANITIZADO del volcado original. Solo datos ficticios.
-- Estructura de la base de datos

-- Tabla de usuarios
CREATE TABLE usuarios (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nombre_usuario TEXT NOT NULL UNIQUE,
  contrasena TEXT NOT NULL,
  correo TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de roles
CREATE TABLE roles (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nombre TEXT NOT NULL UNIQUE
);

-- Tabla de tipo_examen_medico
CREATE TABLE tipo_examen_medico (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nombre TEXT NOT NULL UNIQUE
);

-- Tabla de pacientes
CREATE TABLE pacientes (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  -- Información personal
  rut TEXT NOT NULL UNIQUE,
  primer_nombre TEXT NOT NULL,
  apellido_paterno TEXT NOT NULL,
  apellido_materno TEXT,
  fecha_nacimiento DATE NOT NULL,
  sexo TEXT NOT NULL CHECK (sexo IN ('M', 'F', 'O')),
  nacionalidad TEXT,
  estado_civil TEXT CHECK (estado_civil IN ('soltero', 'casado', 'divorciado', 'viudo', 'union_libre')),
  -- Información de contacto
  email TEXT NOT NULL,
  telefono TEXT,
  direccion TEXT,
  contacto_emergencia_nombre TEXT,
  contacto_emergencia_telefono TEXT,
  contacto_emergencia_relacion TEXT,
  -- Información de previsión social
  tipo_prevision TEXT,
  tiene_convenio BOOLEAN DEFAULT FALSE,
  -- Información médica
  grupo_sanguineo TEXT,
  alergias TEXT,
  enfermedades_cronicas TEXT,
  discapacidades TEXT,
  observaciones_medicas_generales TEXT,
  usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de usuario_roles (relación muchos a muchos)
CREATE TABLE usuario_roles (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  rol_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(usuario_id, rol_id)
);

-- Tabla de examen_medico
CREATE TABLE examen_medico (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  tipo_examen_medico_id BIGINT NOT NULL REFERENCES tipo_examen_medico(id),
  paciente_id BIGINT NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  diagnosis TEXT,
  tratamiento TEXT,
  observaciones TEXT,
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de documentos_examen
CREATE TABLE documentos_examen (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  examen_medico_id BIGINT NOT NULL REFERENCES examen_medico(id) ON DELETE CASCADE,
  paciente_id BIGINT NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  documento BYTEA NOT NULL,
  nombre_archivo TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de auditoria
CREATE TABLE auditoria (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  accion TEXT NOT NULL,
  fecha_hora TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar el rendimiento
CREATE INDEX idx_pacientes_rut ON pacientes(rut);
CREATE INDEX idx_pacientes_usuario_id ON pacientes(usuario_id);
CREATE INDEX idx_examen_medico_paciente_id ON examen_medico(paciente_id);
CREATE INDEX idx_documentos_examen_examen_id ON documentos_examen(examen_medico_id);
CREATE INDEX idx_documentos_examen_paciente_id ON documentos_examen(paciente_id);
CREATE INDEX idx_auditoria_usuario_id ON auditoria(usuario_id);
CREATE INDEX idx_auditoria_fecha_hora ON auditoria(fecha_hora);

-- Insertar roles iniciales
INSERT INTO roles (nombre) VALUES ('admin'), ('medico'), ('paciente');

-- Insertar tipos de examen médico iniciales
INSERT INTO tipo_examen_medico (nombre) VALUES 
  ('Hemograma completo'),
  ('Perfil lipídico'),
  ('Glicemia'),
  ('Radiografía de tórax'),
  ('Electrocardiograma'),
  ('Ecografía abdominal'),
  ('Prueba de función hepática'),
  ('Prueba de función renal'),
  ('Análisis de orina'),
  ('Otro');


-- Datos 100% sintéticos, exclusivos del laboratorio QA (no se incluyen fichas reales).
CREATE TABLE qa_lab_marker (id INT PRIMARY KEY, etiqueta TEXT NOT NULL);
INSERT INTO qa_lab_marker VALUES (1, 'CUIDARTE_QA_PUBLIC_20261028');
INSERT INTO usuarios (nombre_usuario, contrasena, correo) VALUES
  ('qa_admin', 'demo_admin_qa', 'admin@qa.invalid'),
  ('qa_medico', 'demo_medico_qa', 'medico@qa.invalid'),
  ('qa_paciente', 'demo_paciente_qa', 'paciente@qa.invalid');
INSERT INTO usuario_roles (usuario_id, rol_id)
  SELECT u.id, r.id FROM usuarios u JOIN roles r
  ON (u.nombre_usuario='qa_admin' AND r.nombre='admin')
  OR (u.nombre_usuario='qa_medico' AND r.nombre='medico')
  OR (u.nombre_usuario='qa_paciente' AND r.nombre='paciente');
INSERT INTO pacientes (rut, primer_nombre, apellido_paterno, fecha_nacimiento, sexo, email, telefono, usuario_id,
                       alergias, observaciones_medicas_generales)
VALUES ('99999999-9','Paciente','Laboratorio','2000-01-01','O','paciente@qa.invalid','000000000',
        (SELECT id FROM usuarios WHERE nombre_usuario='qa_paciente'),
        'Sin datos reales','Registro sintético de evaluación');
INSERT INTO examen_medico (tipo_examen_medico_id, paciente_id, diagnosis, observaciones)
SELECT (SELECT id FROM tipo_examen_medico ORDER BY id LIMIT 1), p.id,
       'Diagnóstico sintético de QA', 'Examen utilizado para demostraciones académicas'
FROM pacientes p WHERE p.rut='99999999-9';
